// scanner.ts — replaces src/scanner/scanner.ts

import {
  Connection,
  Logs,
  PublicKey
} from "@solana/web3.js";

import {
  PUMP_PROGRAM_ID,
  createConnection,
  extractCandidateFromLogs
} from "./pumpfun.js";

import {
  decodeCreateInstruction,
  decodeBondingCurveAccount,
  findPumpCreateInstruction,
  RawInstructionLike
} from "./pumpfun-decoder.js";

import {
  computeTop10Percent
} from "./holder-analysis.js";

import {
  TokenCandidate,
  ScannerStats
} from "./types.js";

import {
  evaluateToken
} from "./filters.js";

import {
  saveTokenCandidate
} from "../db/scanner-repository.js";

import {
  logger
} from "../utils/logger.js";

export type TokenHandler =
  (
    telegramId: number,
    token: TokenCandidate
  ) => Promise<void>;

interface ScannerOptions {
  onToken?: TokenHandler;
}

export class PumpScanner {
  private connection: Connection;

  private subscriptionId:
    | number
    | null = null;

  private reconnectTimer:
    | NodeJS.Timeout
    | null = null;

  private running = false;

  private stats: ScannerStats = {
    running: false,

    discovered: 0,
    evaluated: 0,
    passed: 0,
    rejected: 0,

    lastEventAt: null,
    lastCandidateAt: null,

    websocketReconnects: 0
  };

  private readonly onToken?:
    TokenHandler;

  constructor(
    options: ScannerOptions = {}
  ) {
    this.onToken =
      options.onToken;

    this.connection =
      createConnection();
  }

  getStats(): ScannerStats {
    return {
      ...this.stats
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    this.stats.running =
      true;

    await this.connect();

    logger.info(
      "Pump.fun scanner started."
    );
  }

  async stop(): Promise<void> {
    this.running = false;

    this.stats.running =
      false;

    if (
      this.subscriptionId !== null
    ) {
      try {
        await this.connection
          .removeOnLogsListener(
            this.subscriptionId
          );
      } catch {
        // Listener may already be gone.
      }

      this.subscriptionId =
        null;
    }

    if (
      this.reconnectTimer
    ) {
      clearTimeout(
        this.reconnectTimer
      );

      this.reconnectTimer =
        null;
    }

    logger.info(
      "Pump.fun scanner stopped."
    );
  }

  private async connect(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (
      this.subscriptionId !== null
    ) {
      return;
    }

    try {
      this.subscriptionId =
        await this.connection.onLogs(
          PUMP_PROGRAM_ID,
          async (
            logInfo: Logs,
            context
          ) => {
            await this.handleLogs(
              logInfo,
              context.slot
            );
          },
          "confirmed"
        );

      logger.info(
        "Subscribed to Pump.fun program logs."
      );
    } catch (error) {
      logger.error(
        "Pump.fun subscription failed.",
        error
      );

      this.scheduleReconnect();
    }
  }

  private async handleLogs(
    info: Logs,
    slot: number
  ): Promise<void> {
    if (!this.running) {
      return;
    }

    this.stats.lastEventAt =
      Date.now();

    if (info.err) {
      return;
    }

    const candidate =
      extractCandidateFromLogs(
        info.signature,
        info.logs,
        slot,
        null
      );

    if (!candidate) {
      return;
    }

    this.stats.discovered++;

    this.stats.lastCandidateAt =
      Date.now();

    logger.info(
      `Pump.fun candidate ${info.signature}`
    );

    const token =
      await this.enrichCandidate(
        candidate.signature
      );

    if (!token) {
      return;
    }

    this.stats.evaluated++;

    saveTokenCandidate(token);
  }

  private async enrichCandidate(
    signature: string
  ): Promise<TokenCandidate | null> {
    let transaction;

    try {
      transaction =
        await this.connection.getParsedTransaction(
          signature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0
          }
        );
    } catch (error) {
      logger.warn(
        `Failed to fetch ${signature}`,
        error
      );

      return null;
    }

    if (!transaction) {
      return null;
    }

    /*
     * Find and decode the real Pump.fun "create"
     * instruction. This is the authoritative source
     * for name/symbol/uri/mint/bondingCurve — we do
     * not guess these from token balances or logs.
     */

    const rawInstructions: RawInstructionLike[] =
      transaction.transaction.message.instructions
        .filter(
          (ix: any) =>
            "data" in ix && "accounts" in ix
        )
        .map((ix: any) => ({
          programId: new PublicKey(ix.programId),
          accounts: ix.accounts.map(
            (a: any) => new PublicKey(a)
          ),
          data: ix.data
        }));

    const createIx =
      findPumpCreateInstruction(
        rawInstructions,
        PUMP_PROGRAM_ID
      );

    if (!createIx) {
      return null;
    }

    const decoded =
      decodeCreateInstruction(createIx);

    if (!decoded || !decoded.mint) {
      logger.warn(
        `Failed to decode create instruction for ${signature}`
      );

      return null;
    }

    const mint = decoded.mint;

    const creator =
      decoded.user ??
      transaction.transaction.message.accountKeys.find(
        (account: any) => account.signer
      )?.pubkey?.toBase58() ??
      null;

    const blockTime =
      transaction.blockTime ??
      Math.floor(
        Date.now() / 1000
      );

    const ageSeconds =
      Math.max(
        0,
        Math.floor(
          Date.now() / 1000 -
            blockTime
        )
      );

    let mintInfo;

    try {
      mintInfo =
        await this.connection.getParsedAccountInfo(
          new PublicKey(mint),
          "confirmed"
        );
    } catch {
      return null;
    }

    const parsed =
      (
        mintInfo.value?.data as any
      )?.parsed;

    const mintData =
      parsed?.info;

    if (!mintData) {
      return null;
    }

    const mintAuthority =
      mintData.mintAuthority ??
      null;

    const freezeAuthority =
      mintData.freezeAuthority ??
      null;

    let isBondingCurve = false;
    let curveLiquiditySol: number | null = null;

    if (decoded.bondingCurve) {
      try {
        const curveAccountInfo =
          await this.connection.getAccountInfo(
            new PublicKey(decoded.bondingCurve),
            "confirmed"
          );

        if (curveAccountInfo?.data) {
          const curve =
            decodeBondingCurveAccount(
              curveAccountInfo.data
            );

          if (curve) {
            isBondingCurve = true;

            curveLiquiditySol =
              Number(curve.realSolReserves) /
              1_000_000_000;
          }
        }
      } catch (error) {
        logger.warn(
          `Failed to fetch bonding curve account for ${signature}`,
          error
        );
      }
    }

    const top10Percent =
      await computeTop10Percent(
        this.connection,
        mint,
        decoded.associatedBondingCurve
      );

    const token: TokenCandidate = {
      mint,

      name: decoded.name,
      symbol: decoded.symbol,
      uri: decoded.uri,

      creator,

      discoveredAt:
        Date.now(),

      ageSeconds,

      bondingCurve:
        decoded.bondingCurve,

      isBondingCurve,

      mintAuthorityRevoked:
        mintAuthority === null,

      freezeAuthorityRevoked:
        freezeAuthority === null,

      top10Percent,

      curveLiquiditySol,

      volume1mUsd: null,

      creatorDumping: false,

      smartMoneyOverride: false,

      passed: false,

      rejectionReasons: []
    };

    return token;
  }

  private scheduleReconnect(): void {
    if (
      !this.running ||
      this.reconnectTimer
    ) {
      return;
    }

    this.stats.websocketReconnects++;

    this.reconnectTimer =
      setTimeout(
        async () => {
          this.reconnectTimer =
            null;

          this.subscriptionId =
            null;

          await this.connect();
        },
        3000
      );
  }
}

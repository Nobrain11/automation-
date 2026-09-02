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

  /** Max parallel RPC enrich jobs (public RPCs need 1). */
  private enrichInFlight = 0;

  private readonly maxEnrichInFlight = 1;

  /** Pending signatures waiting for enrich. */
  private readonly enrichQueue: string[] = [];

  private enrichTimer: NodeJS.Timeout | null = null;

  /** Min gap between RPC enrich starts (ms). */
  private readonly enrichGapMs = 1500;

  private lastEnrichAt = 0;

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

    if (this.enrichTimer) {
      clearTimeout(this.enrichTimer);
      this.enrichTimer = null;
    }

    this.enrichQueue.length = 0;

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

    /*
     * Public RPCs (and many free tiers) hard-rate-limit.
     * Queue enrich work so we never stampede getParsedTransaction.
     */
    this.enqueueEnrich(
      candidate.signature
    );
  }

  private enqueueEnrich(
    signature: string
  ): void {
    if (this.enrichQueue.length >= 40) {
      this.enrichQueue.shift();
    }

    this.enrichQueue.push(signature);
    this.scheduleEnrichPump();
  }

  private scheduleEnrichPump(): void {
    if (this.enrichTimer) {
      return;
    }

    const wait = Math.max(
      0,
      this.enrichGapMs -
        (Date.now() - this.lastEnrichAt)
    );

    this.enrichTimer = setTimeout(
      () => {
        this.enrichTimer = null;
        void this.pumpEnrichQueue();
      },
      wait
    );
  }

  private async pumpEnrichQueue(): Promise<void> {
    while (
      this.enrichInFlight < this.maxEnrichInFlight &&
      this.enrichQueue.length > 0
    ) {
      const signature =
        this.enrichQueue.shift();

      if (!signature) {
        break;
      }

      this.enrichInFlight++;
      this.lastEnrichAt = Date.now();

      try {
        await this.processSignature(
          signature
        );
      } catch (error) {
        logger.warn(
          `Enrich failed for ${signature}`,
          error
        );
      } finally {
        this.enrichInFlight--;
      }
    }

    if (this.enrichQueue.length > 0) {
      this.scheduleEnrichPump();
    }
  }

  private async processSignature(
    signature: string
  ): Promise<void> {
    const token =
      await this.enrichCandidate(
        signature
      );

    if (!token) {
      return;
    }

    this.stats.evaluated++;

    const result = evaluateToken(token, 0);

    token.passed = result.passed;
    token.rejectionReasons = result.reasons;

    if (result.passed) {
      this.stats.passed++;
    } else {
      this.stats.rejected++;
    }

    saveTokenCandidate(token);

    if (this.onToken) {
      try {
        await this.onToken(0, token);
      } catch (error) {
        logger.warn(
          "onToken handler failed",
          error
        );
      }
    }
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
      const msg =
        error instanceof Error
          ? error.message
          : String(error);

      if (msg.includes("429")) {
        logger.warn(
          `RPC 429 on ${signature.slice(0, 12)}… — slowing down`
        );
        // Push back onto queue with delay
        this.enrichQueue.unshift(signature);
        this.lastEnrichAt = Date.now() + 5000;
      } else {
        logger.warn(
          `Failed to fetch ${signature}`,
          error
        );
      }

      return null;
    }

    if (!transaction) {
      return null;
    }

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
          `Failed to fetch bonding curve for ${signature}`,
          error
        );
      }
    }

    // Skip holder analysis under rate pressure — saves several RPC calls
    let top10Percent: number | null = null;
    try {
      top10Percent =
        await computeTop10Percent(
          this.connection,
          mint,
          decoded.associatedBondingCurve
        );
    } catch {
      top10Percent = null;
    }

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

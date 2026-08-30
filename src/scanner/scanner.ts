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

    /*
     * Actual token enrichment happens
     * here in the next stage.
     *
     * We intentionally don't fabricate
     * token information from logs.
     */

    const token =
      await this.enrichCandidate(
        candidate.signature
      );

    if (!token) {
      return;
    }

    this.stats.evaluated++;

    /*
     * The user-specific settings are applied
     * by the bot's auto-engine later.
     *
     * Scanner discovery itself remains global.
     */

    saveTokenCandidate(token);
  }

  private async enrichCandidate(
    signature: string
  ): Promise<TokenCandidate | null> {
    /*
     * Fetch the real transaction from Solana.
     */

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
     * Locate token mint candidates
     * from post-token balances.
     */

    const balances =
      transaction.meta
        ?.postTokenBalances ?? [];

    if (
      balances.length === 0
    ) {
      return null;
    }

    const mint =
      balances[0]?.mint;

    if (!mint) {
      return null;
    }

    /*
     * Creator resolution.
     *
     * For now use the first signer.
     * Deeper creator verification is
     * performed by the holder-analysis
     * stage.
     */

    const signer =
      transaction.transaction.message
        .accountKeys
        .find(
          (account: any) =>
            account.signer
        );

    const creator =
      signer?.pubkey?.toBase58() ??
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

    /*
     * Fetch mint account.
     */

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

    const token: TokenCandidate = {
      mint,

      name: null,
      symbol: null,
      uri: null,

      creator,

      discoveredAt:
        Date.now(),

      ageSeconds,

      bondingCurve: null,

      /*
       * We only mark this true after
       * explicit Pump.fun curve verification.
       *
       * Never assume every Pump.fun tx
       * is a curve token.
       */
      isBondingCurve: false,

      mintAuthorityRevoked:
        mintAuthority === null,

      freezeAuthorityRevoked:
        freezeAuthority === null,

      top10Percent: null,

      curveLiquiditySol: null,

      volume1mUsd: null,

      creatorDumping: false,

      smartMoneyOverride: false,

      passed: false,

      rejectionReasons: []
    };

    /*
     * IMPORTANT:
     *
     * No fake "bonding curve = true"
     * is inserted here.
     *
     * The Pump.fun account decoder comes
     * in the next scanner substage.
     */

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

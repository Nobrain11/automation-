/*
 * Simple sliding-window rate limiter for outbound Solana
 * RPC calls. Helius' free tier caps at 10 requests/second —
 * this defaults to a safer 6/sec to leave headroom for
 * retries and other concurrent activity (e.g. the bot's
 * own wallet balance checks), and is configurable via
 * RPC_MAX_PER_SECOND if you upgrade plans later.
 *
 * Usage: await rpcLimiter.acquire() immediately before
 * every this.connection.* call.
 */

class RpcLimiter {
  private readonly maxPerSecond: number;
  private readonly windowMs = 1000;
  private timestamps: number[] = [];

  constructor(maxPerSecond: number) {
    this.maxPerSecond = maxPerSecond;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    this.timestamps = this.timestamps.filter(
      (t) => now - t < this.windowMs
    );

    if (this.timestamps.length >= this.maxPerSecond) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 10;

      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, waitMs))
      );

      return this.acquire();
    }

    this.timestamps.push(now);
  }
}

const maxPerSecond = Number(
  process.env.RPC_MAX_PER_SECOND ?? "6"
);

export const rpcLimiter = new RpcLimiter(
  Number.isFinite(maxPerSecond) && maxPerSecond > 0
    ? maxPerSecond
    : 6
);

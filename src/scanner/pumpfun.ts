import {
  Connection,
  PublicKey
} from "@solana/web3.js";

import { config } from "../config.js";

/*
 * Official Pump.fun bonding-curve program (mainnet + devnet):
 * 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 *
 * Previous default was wrong, so logsSubscribe never saw creates
 * and Decisions stayed empty.
 */
export const PUMP_PROGRAM_ID =
  new PublicKey(
    process.env.PUMP_PROGRAM_ID ??
      "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
  );

export interface PumpTransactionCandidate {
  signature: string;

  mint: string | null;

  creator: string | null;

  slot: number;

  blockTime: number | null;
}

export function createConnection() {
  return new Connection(
    config.rpcUrl,
    {
      commitment: "confirmed"
    }
  );
}

/*
 * We deliberately don't assume that every transaction
 * touching the Pump.fun program is a new token.
 *
 * Phase 3 first identifies candidate transactions.
 * The deeper transaction parser then determines whether
 * the transaction actually created a token.
 */

export function extractCandidateFromLogs(
  signature: string,
  logs: string[],
  slot: number,
  blockTime: number | null
): PumpTransactionCandidate | null {
  const joined =
    logs.join("\n");

  const looksInteresting =
    joined.includes(
      "Program log:"
    ) &&
    (
      joined.includes(
        "create"
      ) ||
      joined.includes(
        "Create"
      )
    );

  if (!looksInteresting) {
    return null;
  }

  return {
    signature,

    mint: null,

    creator: null,

    slot,

    blockTime
  };
}

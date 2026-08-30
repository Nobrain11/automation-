// pumpfun-decoder.ts

import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

/*
 * Anchor 8-byte sighash discriminators.
 *
 * These come from Pump.fun's published IDL
 * (global:create instruction, BondingCurve account).
 * They are fixed values derived from the instruction/
 * account name and do not change between deploys of
 * the same program version.
 */
const CREATE_INSTRUCTION_DISCRIMINATOR = Buffer.from([
  24, 30, 200, 40, 5, 28, 7, 119
]);

const BONDING_CURVE_ACCOUNT_DISCRIMINATOR = Buffer.from([
  23, 183, 248, 55, 96, 216, 172, 96
]);

/*
 * Account ordering for the "create" instruction, per
 * Pump.fun's IDL. Kept as named indices in one place so
 * they're easy to correct if Pump.fun changes account
 * ordering in a future program upgrade.
 */
const CREATE_ACCOUNT_INDEX = {
  mint: 0,
  mintAuthority: 1,
  bondingCurve: 2,
  associatedBondingCurve: 3,
  user: 7
};

export interface DecodedCreateInstruction {
  name: string;
  symbol: string;
  uri: string;

  mint: string | null;
  bondingCurve: string | null;
  user: string | null;
}

export interface DecodedBondingCurve {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

/*
 * Reads a Borsh-encoded string: 4-byte LE length prefix
 * followed by UTF-8 bytes. Returns the string and the
 * offset immediately after it, or null if the buffer is
 * too short to contain a valid string at this offset.
 */
function readBorshString(
  buf: Buffer,
  offset: number
): { value: string; nextOffset: number } | null {
  if (offset + 4 > buf.length) {
    return null;
  }

  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;

  if (end > buf.length) {
    return null;
  }

  return {
    value: buf.toString("utf8", start, end),
    nextOffset: end
  };
}

/*
 * Raw (unparsed) instruction shape as returned by
 * getParsedTransaction for a program Solana's web3.js
 * doesn't have a built-in parser for (Pump.fun is not
 * a well-known program, so its instructions come back
 * "partiallyDecoded" with base58 data + a flat account
 * list rather than named fields).
 */
export interface RawInstructionLike {
  programId: PublicKey;
  accounts: PublicKey[];
  data: string; // base58
}

/*
 * Finds the Pump.fun "create" instruction inside a parsed
 * transaction's instruction list (top-level only — inner
 * instructions aren't needed for token creation).
 */
export function findPumpCreateInstruction(
  instructions: RawInstructionLike[],
  pumpProgramId: PublicKey
): RawInstructionLike | null {
  for (const ix of instructions) {
    if (!ix.programId.equals(pumpProgramId)) {
      continue;
    }

    let data: Buffer;

    try {
      data = Buffer.from(bs58.decode(ix.data));
    } catch {
      continue;
    }

    if (data.length < 8) {
      continue;
    }

    if (
      data
        .subarray(0, 8)
        .equals(CREATE_INSTRUCTION_DISCRIMINATOR)
    ) {
      return ix;
    }
  }

  return null;
}

/*
 * Decodes a Pump.fun "create" instruction: extracts the
 * token's name/symbol/uri from the instruction args, and
 * the mint/bondingCurve/user pubkeys from the accounts list.
 *
 * Returns null if the discriminator doesn't match or the
 * data can't be parsed as expected — never guesses/fabricates
 * values.
 */
export function decodeCreateInstruction(
  ix: RawInstructionLike
): DecodedCreateInstruction | null {
  let data: Buffer;

  try {
    data = Buffer.from(bs58.decode(ix.data));
  } catch {
    return null;
  }

  if (data.length < 8) {
    return null;
  }

  if (
    !data
      .subarray(0, 8)
      .equals(CREATE_INSTRUCTION_DISCRIMINATOR)
  ) {
    return null;
  }

  let offset = 8;

  const nameResult = readBorshString(data, offset);
  if (!nameResult) return null;
  offset = nameResult.nextOffset;

  const symbolResult = readBorshString(data, offset);
  if (!symbolResult) return null;
  offset = symbolResult.nextOffset;

  const uriResult = readBorshString(data, offset);
  if (!uriResult) return null;

  const mint =
    ix.accounts[CREATE_ACCOUNT_INDEX.mint]?.toBase58() ??
    null;

  const bondingCurve =
    ix.accounts[
      CREATE_ACCOUNT_INDEX.bondingCurve
    ]?.toBase58() ?? null;

  const user =
    ix.accounts[CREATE_ACCOUNT_INDEX.user]?.toBase58() ??
    null;

  return {
    name: nameResult.value,
    symbol: symbolResult.value,
    uri: uriResult.value,

    mint,
    bondingCurve,
    user
  };
}

/*
 * Decodes a Pump.fun bonding curve account's raw data.
 * Returns null if the discriminator doesn't match (i.e.
 * this isn't actually a BondingCurve account) or the
 * buffer is too short — never fabricates reserve values.
 */
export function decodeBondingCurveAccount(
  data: Buffer
): DecodedBondingCurve | null {
  if (data.length < 8 + 8 * 5 + 1) {
    return null;
  }

  if (
    !data
      .subarray(0, 8)
      .equals(BONDING_CURVE_ACCOUNT_DISCRIMINATOR)
  ) {
    return null;
  }

  let offset = 8;

  const virtualTokenReserves = data.readBigUInt64LE(offset);
  offset += 8;

  const virtualSolReserves = data.readBigUInt64LE(offset);
  offset += 8;

  const realTokenReserves = data.readBigUInt64LE(offset);
  offset += 8;

  const realSolReserves = data.readBigUInt64LE(offset);
  offset += 8;

  const tokenTotalSupply = data.readBigUInt64LE(offset);
  offset += 8;

  const complete = data.readUInt8(offset) === 1;

  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    complete
  };
}

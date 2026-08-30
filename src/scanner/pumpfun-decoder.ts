// pumpfun-decoder.ts — save as a NEW file at src/scanner/pumpfun-decoder.ts

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
  associatedBondingCurve: string | null;
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

export interface RawInstructionLike {
  programId: PublicKey;
  accounts: PublicKey[];
  data: string; // base58
}

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

  const associatedBondingCurve =
    ix.accounts[
      CREATE_ACCOUNT_INDEX.associatedBondingCurve
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
    associatedBondingCurve,
    user
  };
}

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

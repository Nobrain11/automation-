import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey
} from "@solana/web3.js";

import bs58 from "bs58";

import { config } from "../config.js";
import {
  deleteWallet,
  getWallet,
  saveWallet
} from "../db/repositories.js";

import {
  decrypt,
  encrypt
} from "../utils/crypto.js";

const connection = new Connection(
  config.rpcUrl,
  "confirmed"
);

export function createWallet(
  telegramId: number
): {
  address: string;
  privateKey: string;
} {
  const keypair = Keypair.generate();

  const privateKey = bs58.encode(
    keypair.secretKey
  );

  const encrypted = encrypt(
    privateKey,
    config.walletEncryptionKey
  );

  saveWallet(
    telegramId,
    keypair.publicKey.toBase58(),
    encrypted
  );

  return {
    address: keypair.publicKey.toBase58(),
    privateKey
  };
}

export function importWallet(
  telegramId: number,
  input: string
): string {
  let keypair: Keypair;

  try {
    const decoded = bs58.decode(
      input.trim()
    );

    keypair =
      Keypair.fromSecretKey(decoded);
  } catch {
    try {
      const parsed = JSON.parse(input);

      if (!Array.isArray(parsed)) {
        throw new Error();
      }

      keypair =
        Keypair.fromSecretKey(
          Uint8Array.from(parsed)
        );
    } catch {
      throw new Error(
        "Invalid Solana private key."
      );
    }
  }

  const privateKey = bs58.encode(
    keypair.secretKey
  );

  const encrypted = encrypt(
    privateKey,
    config.walletEncryptionKey
  );

  saveWallet(
    telegramId,
    keypair.publicKey.toBase58(),
    encrypted
  );

  return keypair.publicKey.toBase58();
}

export function hasWallet(
  telegramId: number
): boolean {
  return Boolean(
    getWallet(telegramId)
  );
}

export function getAddress(
  telegramId: number
): string | null {
  return (
    getWallet(telegramId)?.public_key ??
    null
  );
}

export async function getBalance(
  telegramId: number
): Promise<number> {
  const wallet =
    getWallet(telegramId);

  if (!wallet) {
    throw new Error(
      "No wallet connected."
    );
  }

  const publicKey = new PublicKey(
    wallet.public_key
  );

  const lamports =
    await connection.getBalance(
      publicKey,
      "confirmed"
    );

  return lamports / LAMPORTS_PER_SOL;
}

export function exportPrivateKey(
  telegramId: number
): string {
  const wallet =
    getWallet(telegramId);

  if (!wallet) {
    throw new Error(
      "No wallet connected."
    );
  }

  return decrypt(
    wallet.encrypted_secret,
    config.walletEncryptionKey
  );
}

export function logout(
  telegramId: number
): void {
  deleteWallet(telegramId);
}

import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

function getKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");

  if (key.length !== 32) {
    throw new Error(
      "Encryption key must contain exactly 32 bytes."
    );
  }

  return key;
}

export function encrypt(
  plaintext: string,
  base64Key: string
): string {
  const key = getKey(base64Key);

  const iv = randomBytes(12);

  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64")
  ].join(".");
}

export function decrypt(
  payload: string,
  base64Key: string
): string {
  const [
    version,
    ivBase64,
    tagBase64,
    encryptedBase64
  ] = payload.split(".");

  if (
    version !== "v1" ||
    !ivBase64 ||
    !tagBase64 ||
    !encryptedBase64
  ) {
    throw new Error("Invalid encrypted wallet payload.");
  }

  const key = getKey(base64Key);

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivBase64, "base64")
  );

  decipher.setAuthTag(
    Buffer.from(tagBase64, "base64")
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encryptedBase64, "base64")
    ),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

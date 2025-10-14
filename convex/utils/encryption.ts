import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("CONNECTION_ENCRYPTION_KEY env var is required");
  }
  const buffer = Buffer.from(secret, /^[A-Za-z0-9+\/=]+$/.test(secret) ? "base64" : "utf8");
  if (buffer.length !== 32) {
    throw new Error("CONNECTION_ENCRYPTION_KEY must resolve to 32 bytes");
  }
  return buffer;
}

export type EncryptedPayload = {
  algorithm: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

export function encryptJson(payload: unknown): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  if (payload.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
  }
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

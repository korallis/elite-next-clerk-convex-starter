import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!secret) throw new Error("CONNECTION_ENCRYPTION_KEY env var is required");
  const buf = Buffer.from(secret, /^[A-Za-z0-9+/=]+$/.test(secret) ? "base64" : "utf8");
  if (buf.length !== 32) throw new Error("CONNECTION_ENCRYPTION_KEY must be 32 bytes");
  return buf;
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
  const pt = Buffer.from(JSON.stringify(payload), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { algorithm: ALGORITHM, iv: iv.toString("base64"), ciphertext: ct.toString("base64"), tag: tag.toString("base64") };
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  if (payload.algorithm !== ALGORITHM) throw new Error("Unsupported algorithm");
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}

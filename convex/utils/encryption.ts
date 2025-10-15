// Placeholder for Convex runtime; real encryption is done in Next.js server (lib/encryption.ts).
export type EncryptedPayload = {
  algorithm: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

export function encryptJson(_payload: unknown): never {
  throw new Error("encryptJson is not available in Convex runtime. Use server-side lib/encryption.ts");
}

export function decryptJson<T>(_payload: EncryptedPayload): T {
  throw new Error("decryptJson is not available in Convex runtime. Use server-side lib/encryption.ts");
}

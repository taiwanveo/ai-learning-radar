import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedSecret {
  encryptedValue: string;
  iv: string;
  authTag: string;
}

function encryptionKey(encoded = process.env.APP_SECRET_KEY): Buffer {
  if (!encoded) throw new Error("APP_SECRET_KEY is required");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("APP_SECRET_KEY must be a base64-encoded 32-byte key");
  return key;
}

export function encryptSecret(secret: string, encodedKey?: string): EncryptedSecret {
  if (!secret) throw new Error("Cannot encrypt an empty secret");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(envelope: EncryptedSecret, encodedKey?: string): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(secret: string): string {
  const suffix = secret.slice(-4);
  const prefix = secret.length >= 12 ? secret.slice(0, Math.min(4, secret.indexOf("-") + 1 || 4)) : "";
  return `${prefix}${"•".repeat(8)}${suffix}`;
}

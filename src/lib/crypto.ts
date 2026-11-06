import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** Public example key shipped in `.env.example` — must never be used for real data. */
const KNOWN_INSECURE_KEYS = new Set(["MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="]);

export type EncryptionKeyStatus = "ok" | "missing" | "invalid" | "insecure_example";

/** Inspect ENCRYPTION_KEY without exposing it (used for the security checklist UI). */
export function getEncryptionKeyStatus(): EncryptionKeyStatus {
  const raw = env().ENCRYPTION_KEY;
  if (!raw) return "missing";
  if (KNOWN_INSECURE_KEYS.has(raw)) return "insecure_example";
  if (Buffer.from(raw, "base64").length !== 32) return "invalid";
  return "ok";
}

function getKey(): Buffer {
  const raw = env().ENCRYPTION_KEY;
  const status = getEncryptionKeyStatus();

  if (status === "ok" || (status === "insecure_example" && env().NODE_ENV !== "production")) {
    return Buffer.from(raw, "base64");
  }

  if (env().NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY wajib diisi dengan 32 byte acak (base64) di production. " +
        "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  // Development-only fallback so the app still boots locally without a key.
  return createHash("sha256").update(env().DATABASE_URL).digest();
}

/** Encrypt sensitive strings (e.g. Meta access tokens) with AES-256-GCM. */
export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

/** Decrypt a payload produced by `encryptSecret`. */
export function decryptSecret(cipherText: string): string {
  const [ivB64, tagB64, dataB64] = cipherText.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Format token terenkripsi tidak valid");
  }
  const key = getKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "Token Meta tidak bisa didekripsi (ENCRYPTION_KEY kemungkinan berubah). Silakan hubungkan ulang akun Meta Anda.",
    );
  }
}

/** Show only the last 4 characters of a secret, e.g. "••••••••a1B2". */
export function maskSecret(secret: string): string {
  if (secret.length <= 4) return "••••";
  return `••••••••${secret.slice(-4)}`;
}

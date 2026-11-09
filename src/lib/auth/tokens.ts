import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildPasswordResetEmail, buildVerificationEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getPublicBaseUrl } from "@/lib/url";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds cooldown between resends

export function hashAuthToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

function deriveOtpCode(userId: string, createdAtMs: number): string {
  const secret = env().ENCRYPTION_KEY || "dibantudigital-otp-secret";
  const digest = createHmac("sha256", secret)
    .update(`${userId}:${createdAtMs}`)
    .digest();
  const num = (digest.readUInt32BE(0) % 900_000) + 100_000;
  return String(num);
}

export async function getActiveVerificationCodeForPreview(userId: string): Promise<string | null> {
  const now = new Date();
  const rows = await db()
    .select({ createdAt: schema.authTokens.createdAt })
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, userId),
        eq(schema.authTokens.type, "email_verify"),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, now),
      ),
    )
    .orderBy(desc(schema.authTokens.createdAt))
    .limit(1);

  if (!rows[0]) return null;
  return deriveOtpCode(userId, rows[0].createdAt.getTime());
}

export async function canSendAuthToken(
  userId: string,
  type: "email_verify" | "password_reset",
): Promise<{ allowed: boolean; waitSeconds: number }> {
  const recent = await db()
    .select({ createdAt: schema.authTokens.createdAt })
    .from(schema.authTokens)
    .where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.type, type)))
    .orderBy(desc(schema.authTokens.createdAt))
    .limit(1);

  if (!recent[0]) return { allowed: true, waitSeconds: 0 };
  const elapsed = Date.now() - recent[0].createdAt.getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    return { allowed: false, waitSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) };
  }
  return { allowed: true, waitSeconds: 0 };
}

export async function issueEmailVerificationToken(params: {
  userId: string;
  name: string;
  email: string;
}): Promise<{ sent: boolean; code: string }> {
  const rawToken = randomBytes(32).toString("hex");
  const createdAt = new Date();
  const code = deriveOtpCode(params.userId, createdAt.getTime());
  const expiresAt = new Date(createdAt.getTime() + VERIFY_TTL_MS);

  await db()
    .insert(schema.authTokens)
    .values({
      userId: params.userId,
      type: "email_verify",
      tokenHash: hashAuthToken(rawToken),
      codeHash: hashAuthToken(code),
      expiresAt,
      createdAt,
    });

  const baseUrl = await getPublicBaseUrl();
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const emailPayload = buildVerificationEmail({ name: params.name, code, verifyUrl });
  const result = await sendEmail({ to: params.email, ...emailPayload });

  return { sent: result.sent, code };
}

export async function verifyEmailWithCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashAuthToken(code);
  const now = new Date();

  const rows = await db()
    .select({ id: schema.authTokens.id })
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, userId),
        eq(schema.authTokens.type, "email_verify"),
        eq(schema.authTokens.codeHash, codeHash),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!rows[0]) return false;

  await db().transaction(async (tx) => {
    await tx
      .update(schema.authTokens)
      .set({ usedAt: now })
      .where(eq(schema.authTokens.id, rows[0].id));
    await tx
      .update(schema.users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(eq(schema.users.id, userId));
  });

  return true;
}

export async function verifyEmailWithToken(
  rawToken: string,
): Promise<{ ok: boolean; userId?: string }> {
  const tokenHash = hashAuthToken(rawToken);
  const now = new Date();

  const rows = await db()
    .select({ id: schema.authTokens.id, userId: schema.authTokens.userId })
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.type, "email_verify"),
        eq(schema.authTokens.tokenHash, tokenHash),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!rows[0]) return { ok: false };

  await db().transaction(async (tx) => {
    await tx
      .update(schema.authTokens)
      .set({ usedAt: now })
      .where(eq(schema.authTokens.id, rows[0].id));
    await tx
      .update(schema.users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(eq(schema.users.id, rows[0].userId));
  });

  return { ok: true, userId: rows[0].userId };
}

export async function issuePasswordResetToken(params: {
  userId: string;
  name: string;
  email: string;
}): Promise<{ sent: boolean; resetUrl: string }> {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await db()
    .insert(schema.authTokens)
    .values({
      userId: params.userId,
      type: "password_reset",
      tokenHash: hashAuthToken(rawToken),
      expiresAt,
    });

  const baseUrl = await getPublicBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const emailPayload = buildPasswordResetEmail({ name: params.name, resetUrl });
  const result = await sendEmail({ to: params.email, ...emailPayload });

  return { sent: result.sent, resetUrl };
}

export async function findValidPasswordResetToken(rawToken: string) {
  if (!rawToken) return null;
  const tokenHash = hashAuthToken(rawToken);
  const now = new Date();

  const rows = await db()
    .select({
      id: schema.authTokens.id,
      userId: schema.authTokens.userId,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.authTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.authTokens.userId))
    .where(
      and(
        eq(schema.authTokens.type, "password_reset"),
        eq(schema.authTokens.tokenHash, tokenHash),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, now),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

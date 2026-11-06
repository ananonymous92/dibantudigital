import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string().optional().default(""),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(7),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Meta App ID (developers.facebook.com → My Apps). Optional but recommended. */
  META_APP_ID: z.string().optional().default(""),
  /**
   * Meta App Secret. When set, every Graph API call is signed with `appsecret_proof`
   * so a leaked access token cannot be used from outside this server.
   */
  META_APP_SECRET: z.string().optional().default(""),
  /** Google OAuth 2.0 Client credentials (console.cloud.google.com). */
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  /** Email delivery via Resend API (https://resend.com) or standard SMTP. */
  RESEND_API_KEY: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default("DibantuDigital <noreply@dibantudigital.id>"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Validated server-side environment variables (parsed lazily so builds don't need a DB). */
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        "Konfigurasi environment tidak valid:\n" +
          parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
    cached = parsed.data;
  }
  return cached;
}


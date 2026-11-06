"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireSession, setActiveWorkspace } from "@/lib/auth/session";
import {
  canSendAuthToken,
  findValidPasswordResetToken,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  verifyEmailWithCode,
} from "@/lib/auth/tokens";
import { createWorkspaceWithTrial } from "@/lib/workspace";

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid")),
  password: z.string().min(8, "Password minimal 8 karakter").max(200),
  workspaceName: z.string().trim().min(2, "Nama bisnis minimal 2 karakter").max(100),
});

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = RegisterSchema.safeParse(raw);
  const values = { name: raw.name ?? "", email: raw.email ?? "", workspaceName: raw.workspaceName ?? "" };
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { name, email, password, workspaceName } = parsed.data;

  let sessionTarget: { userId: string; workspaceId: string };
  try {
    const existing = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing[0]) {
      return { fieldErrors: { email: ["Email sudah terdaftar. Silakan masuk."] }, values };
    }

    const passwordHash = await hashPassword(password);
    sessionTarget = await db().transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ name, email, passwordHash, emailVerifiedAt: null })
        .returning({ id: schema.users.id });
      const workspace = await createWorkspaceWithTrial(tx, user.id, workspaceName);
      return { userId: user.id, workspaceId: workspace.id };
    });

    await issueEmailVerificationToken({
      userId: sessionTarget.userId,
      name,
      email,
    });

    await createSession(sessionTarget.userId, sessionTarget.workspaceId);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Gagal membuat akun: ${err.message}`
          : "Gagal membuat akun.",
      values,
    };
  }

  redirect("/verify-email");
}

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid")),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = LoginSchema.safeParse(raw);
  const values = { email: raw.email ?? "" };
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  let needsVerification = false;
  try {
    const rows = await db()
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        passwordHash: schema.users.passwordHash,
        googleId: schema.users.googleId,
        emailVerifiedAt: schema.users.emailVerifiedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1);
    const user = rows[0];

    if (user && !user.passwordHash && user.googleId) {
      return {
        error:
          "Akun ini terdaftar menggunakan Google. Silakan klik tombol 'Lanjutkan dengan Google' di atas, atau klik 'Lupa password?' untuk membuat password.",
        values,
      };
    }

    const ok = await verifyPassword(parsed.data.password, user?.passwordHash || null);
    if (!user || !ok) {
      return { error: "Email atau password salah.", values };
    }

    await createSession(user.id, null);

    if (!user.emailVerifiedAt) {
      needsVerification = true;
      const cooldown = await canSendAuthToken(user.id, "email_verify");
      if (cooldown.allowed) {
        await issueEmailVerificationToken({
          userId: user.id,
          name: user.name,
          email: user.email,
        });
      }
    }
  } catch (err) {
    return {
      error: err instanceof Error ? `Gagal masuk: ${err.message}` : "Gagal masuk.",
      values,
    };
  }

  redirect(needsVerification ? "/verify-email" : "/app");
}

export async function verifyEmailCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");

  if (!/^\d{6}$/.test(code)) {
    return { error: "Masukkan 6 digit kode angka yang dikirim ke email Anda." };
  }

  const ok = await verifyEmailWithCode(session.user.id, code);
  if (!ok) {
    return {
      error: "Kode verifikasi salah atau sudah kedaluwarsa. Silakan minta kode baru.",
    };
  }

  redirect("/app?verified=1");
}

export async function resendVerificationEmailAction(_prev: FormState): Promise<FormState> {
  const session = await requireSession();
  if (session.user.emailVerifiedAt) {
    redirect("/app");
  }

  const cooldown = await canSendAuthToken(session.user.id, "email_verify");
  if (!cooldown.allowed) {
    return {
      error: `Mohon tunggu ${cooldown.waitSeconds} detik sebelum mengirim ulang kode verifikasi.`,
    };
  }

  const res = await issueEmailVerificationToken({
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (!res.sent) {
    return {
      error:
        "Server email (SMTP / Resend) belum dikonfigurasi di .env server. Silakan hubungi administrator atau gunakan Google Login.",
    };
  }

  return {
    success: `Kode verifikasi 6 digit baru telah dikirim ke ${session.user.email}.`,
  };
}

const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid")),
});

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = ForgotPasswordSchema.safeParse(raw);
  const values = { email: raw.email ?? "" };

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    const rows = await db()
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1);

    const user = rows[0];
    if (user) {
      const cooldown = await canSendAuthToken(user.id, "password_reset");
      if (cooldown.allowed) {
        await issuePasswordResetToken({
          userId: user.id,
          name: user.name,
          email: user.email,
        });
      }
    }
  } catch (err) {
    console.error("[auth/forgot-password] error:", err);
    return {
      error: "Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.",
      values,
    };
  }

  return {
    success:
      "Jika alamat email tersebut terdaftar di DibantuDigital, kami telah mengirimkan link untuk membuat password baru ke kotak masuk Anda. Silakan cek Inbox atau folder Spam.",
    values: { email: "" },
  };
}

const ResetPasswordSchema = z
  .object({
    token: z.string().min(10, "Token reset password tidak valid."),
    password: z.string().min(8, "Password baru minimal 8 karakter").max(200),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama dengan password baru.",
  });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = ResetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { token, password } = parsed.data;
  const resetRow = await findValidPasswordResetToken(token);
  if (!resetRow) {
    return {
      error: "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta link baru.",
    };
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db().transaction(async (tx) => {
    await tx
      .update(schema.authTokens)
      .set({ usedAt: now })
      .where(eq(schema.authTokens.id, resetRow.id));

    const userRows = await tx
      .select({ emailVerifiedAt: schema.users.emailVerifiedAt })
      .from(schema.users)
      .where(eq(schema.users.id, resetRow.userId))
      .limit(1);

    await tx
      .update(schema.users)
      .set({
        passwordHash,
        emailVerifiedAt: userRows[0]?.emailVerifiedAt ?? now,
        updatedAt: now,
      })
      .where(eq(schema.users.id, resetRow.userId));

    // Invalidate all previous sessions for security
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, resetRow.userId));
  });

  await createSession(resetRow.userId, null);
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function switchWorkspaceAction(formData: FormData) {
  const id = String(formData.get("workspaceId") ?? "");
  await setActiveWorkspace(id);
  redirect("/app");
}

const OnboardingSchema = z.object({
  workspaceName: z.string().trim().min(2, "Nama bisnis minimal 2 karakter").max(100),
});

export async function createWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = OnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: raw };
  }
  const workspace = await db().transaction((tx) =>
    createWorkspaceWithTrial(tx, session.user.id, parsed.data.workspaceName),
  );
  await setActiveWorkspace(workspace.id);
  redirect("/app");
}

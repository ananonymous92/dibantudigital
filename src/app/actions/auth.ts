"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireSession, setActiveWorkspace } from "@/lib/auth/session";
import { createWorkspaceWithTrial } from "@/lib/workspace";

export type FormState = {
  error?: string;
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
        .values({ name, email, passwordHash })
        .returning({ id: schema.users.id });
      const workspace = await createWorkspaceWithTrial(tx, user.id, workspaceName);
      return { userId: user.id, workspaceId: workspace.id };
    });

    await createSession(sessionTarget.userId, sessionTarget.workspaceId);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Gagal terhubung ke database: ${err.message}. Pastikan PostgreSQL aktif (docker compose up -d) dan tabel sudah dibuat (npm run db:push).`
          : "Gagal membuat akun.",
      values,
    };
  }

  redirect("/app");
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

  try {
    const rows = await db()
      .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1);
    const user = rows[0];

    const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);
    if (!user || !ok) {
      return { error: "Email atau password salah.", values };
    }

    await createSession(user.id, null);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Gagal terhubung ke database: ${err.message}. Pastikan PostgreSQL aktif (docker compose up -d) dan tabel sudah dibuat (npm run db:push).`
          : "Gagal masuk.",
      values,
    };
  }

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


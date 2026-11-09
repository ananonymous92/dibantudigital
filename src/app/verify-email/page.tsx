import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Alert } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { getActiveVerificationCodeForPreview, issueEmailVerificationToken } from "@/lib/auth/tokens";
import { isEmailConfigured } from "@/lib/email";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = { title: "Verifikasi Email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (session.user.emailVerifiedAt) {
    redirect("/app");
  }

  const sp = await searchParams;
  const emailReady = isEmailConfigured();
  let previewCode: string | null = null;

  if (!emailReady) {
    previewCode = await getActiveVerificationCodeForPreview(session.user.id);
    if (!previewCode) {
      const issued = await issueEmailVerificationToken({
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });
      previewCode = issued.code;
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-bold">Verifikasi email Anda</h1>
          <p className="mt-2 text-sm text-slate-500">
            Kami telah mengirimkan kode verifikasi 6 digit ke{" "}
            <strong className="text-slate-800">{session.user.email}</strong>. Masukkan kode tersebut di bawah ini atau
            klik tombol verifikasi di dalam email Anda.
          </p>

          {sp.error === "expired_token" && (
            <div className="mt-4">
              <Alert>Link verifikasi sudah kedaluwarsa. Silakan minta kode baru di bawah ini.</Alert>
            </div>
          )}

          {!emailReady && previewCode && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
              <p className="font-semibold">Mode Preview (SMTP Email belum diisi di .env):</p>
              <p className="mt-1">
                Gunakan kode verifikasi 6 digit berikut untuk langsung mengaktifkan akun Anda:
              </p>
              <div className="mt-2 rounded-lg bg-white py-2 text-center font-mono text-2xl font-extrabold tracking-[0.35em] text-slate-900 shadow-2xs">
                {previewCode}
              </div>
            </div>
          )}

          <div className="mt-8">
            <VerifyEmailForm defaultCode={previewCode ?? undefined} />
          </div>

          <form action={logoutAction} className="mt-6 text-center">
            <button
              type="submit"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              Salah alamat email? Keluar &amp; ganti akun
            </button>
          </form>
        </div>
      </div>
      <div className="hidden flex-col justify-center bg-sidebar p-12 text-white lg:flex">
        <h2 className="text-3xl font-bold leading-tight">
          Satu langkah lagi menuju
          <br />
          dashboard Meta Ads Anda.
        </h2>
        <ul className="mt-8 space-y-3 text-slate-300">
          <li>✓ Cek kotak masuk (Inbox) atau folder Spam/Promosi</li>
          <li>✓ Masukkan 6 digit angka kode verifikasi</li>
          <li>✓ Langsung nikmati akses penuh Trial Gratis 7 Hari</li>
        </ul>
      </div>
    </div>
  );
}

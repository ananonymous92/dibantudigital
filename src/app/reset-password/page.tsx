import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Alert } from "@/components/ui";
import { findValidPasswordResetToken } from "@/lib/auth/tokens";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Buat Password Baru" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const resetRow = await findValidPasswordResetToken(token);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-bold">Buat password baru</h1>

          {!resetRow ? (
            <div className="mt-6 space-y-5">
              <Alert>
                Link reset password ini tidak valid atau sudah kedaluwarsa (berlaku 1 jam). Silakan minta link baru.
              </Alert>
              <Link
                href="/forgot-password"
                className="flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Minta Link Reset Password Baru
              </Link>
              <p className="text-center text-sm text-slate-500">
                <Link href="/login" className="font-semibold text-brand-600 hover:underline">
                  Kembali ke halaman Masuk
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Masukkan password baru untuk akun <strong className="text-slate-700">{resetRow.email}</strong>.
              </p>
              <div className="mt-8">
                <ResetPasswordForm token={token} />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="hidden flex-col justify-center bg-sidebar p-12 text-white lg:flex">
        <h2 className="text-3xl font-bold leading-tight">
          Amankan akun Anda,
          <br />
          lanjutkan optimasi Meta Ads.
        </h2>
        <ul className="mt-8 space-y-3 text-slate-300">
          <li>✓ Password dienkripsi dengan standar bcrypt</li>
          <li>✓ Sesi perangkat lama otomatis dikeluarkan saat reset</li>
          <li>✓ Akses kembali seluruh data workspace Anda</li>
        </ul>
      </div>
    </div>
  );
}


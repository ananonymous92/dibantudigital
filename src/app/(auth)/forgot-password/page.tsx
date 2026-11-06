import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Lupa Password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Lupa password?</h1>
      <p className="mt-2 text-sm text-slate-500">
        Masukkan email akun Anda. Kami akan mengirimkan link untuk mengatur ulang password Anda.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Sudah ingat password Anda?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Kembali ke halaman Masuk
        </Link>
      </p>
    </>
  );
}


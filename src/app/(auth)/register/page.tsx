import type { Metadata } from "next";
import Link from "next/link";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Mulai gratis 7 hari</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tanpa kartu kredit. Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Masuk
        </Link>
      </p>
      <div className="mt-8 space-y-5">
        <GoogleAuthButton label="Daftar dengan Google" />
        <RegisterForm />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Masuk ke akun Anda</h1>
      <p className="mt-2 text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Coba gratis 7 hari
        </Link>
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </>
  );
}


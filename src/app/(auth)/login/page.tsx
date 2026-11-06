import type { Metadata } from "next";
import Link from "next/link";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured:
    "Login Google belum dikonfigurasi oleh admin (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET belum diisi di .env).",
  google_cancelled: "Login dengan Google dibatalkan.",
  invalid_state: "Sesi login Google kedaluwarsa. Silakan coba klik tombol Google sekali lagi.",
  missing_code: "Kode otorisasi Google tidak ditemukan.",
  google_token_failed: "Gagal memverifikasi token Google. Pastikan Redirect URI di Google Cloud Console sudah sesuai.",
  google_profile_failed: "Gagal mengambil profil email dari akun Google Anda.",
  google_server_error: "Terjadi kesalahan saat menghubungkan ke Google. Silakan coba lagi.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth_error?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const oauthErrorMessage = sp.oauth_error ? (OAUTH_ERRORS[sp.oauth_error] ?? sp.oauth_error) : null;

  return (
    <>
      <h1 className="text-2xl font-bold">Masuk ke akun Anda</h1>
      <p className="mt-2 text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Coba gratis 7 hari
        </Link>
      </p>
      <div className="mt-8 space-y-5">
        {oauthErrorMessage && <Alert>{oauthErrorMessage}</Alert>}
        {sp.reset === "success" && (
          <Alert tone="success">Password berhasil diubah. Silakan masuk dengan password baru Anda.</Alert>
        )}
        <GoogleAuthButton label="Lanjutkan dengan Google" />
        <LoginForm />
      </div>
    </>
  );
}

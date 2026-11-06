import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  KeyRound,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { db, schema } from "@/db";
import { Alert, Badge } from "@/components/ui";
import { decryptSecret, getEncryptionKeyStatus, maskSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { listMetaAdAccounts, type MetaAdAccountItem } from "@/lib/meta-api";
import { requireWorkspace } from "@/lib/tenant";
import { defaultSyncDateRange, formatDate, isPastDate } from "@/lib/utils";
import {
  DisconnectMetaButton,
  SaveMetaConnectionForm,
  SelectAdAccountForm,
  SyncMetaNowForm,
} from "./connection-forms";

export const metadata: Metadata = { title: "Koneksi Meta API" };

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
      )}
      <span className={ok ? "text-slate-700" : "text-amber-800"}>{children}</span>
    </li>
  );
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_app_config:
    "Fitur 1-Klik Login Facebook membutuhkan META_APP_ID dan META_APP_SECRET di file .env server Anda. Ikuti panduan singkat di bawah atau gunakan Input Token Manual.",
  forbidden: "Hanya Owner atau Admin workspace yang dapat menghubungkan akun Meta.",
  invalid_state: "Sesi otorisasi kedaluwarsa atau tidak valid. Silakan klik tombol Hubungkan dengan Facebook sekali lagi.",
  missing_code: "Login Facebook dibatalkan sebelum kode otorisasi diterima.",
  no_ad_accounts:
    "Akun Facebook ini belum memiliki Ad Account (Akun Iklan) yang aktif di Meta Ads Manager.",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; oauth_error?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const rows = await db()
    .select()
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.workspaceId, ctx.workspace.id))
    .limit(1);
  const conn = rows[0] ?? null;

  // Only the last 4 characters are ever rendered — the full token never leaves the server.
  let maskedToken: string | null = null;
  let tokenReadable = true;
  let availableAccounts: MetaAdAccountItem[] = [];

  if (conn) {
    try {
      const plainToken = decryptSecret(conn.encryptedAccessToken);
      maskedToken = maskSecret(plainToken);
      // Try fetching all Ad Accounts accessible by this token for the 1-click dropdown
      try {
        availableAccounts = await listMetaAdAccounts(plainToken);
      } catch {
        // Non-fatal if offline or token only has access to the single saved account
      }
    } catch {
      tokenReadable = false;
    }
  }

  const keyStatus = getEncryptionKeyStatus();
  const { META_APP_ID, META_APP_SECRET, APP_URL } = env();
  const appSecretOn = Boolean(META_APP_ID && META_APP_SECRET);
  const httpsOn = APP_URL.startsWith("https://");
  const tokenExpired = isPastDate(conn?.tokenExpiresAt);
  const syncRange = defaultSyncDateRange();
  const callbackUrl = `${APP_URL.replace(/\/$/, "")}/api/meta/oauth/callback`;

  const oauthErrorText = sp.oauth_error
    ? (OAUTH_ERROR_MESSAGES[sp.oauth_error] ?? sp.oauth_error)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Koneksi Langsung Meta Marketing API</h1>
        <p className="text-xs text-slate-500">
          Hubungkan akun Meta Ads Anda dengan 1 klik (Read-Only). Token dienkripsi AES-256-GCM dan terisolasi khusus untuk workspace Anda.
        </p>
      </div>

      {sp.oauth === "connected" && (
        <Alert tone="success">
          Berhasil terhubung dengan Facebook! Pilih Ad Account Anda di bawah lalu klik{" "}
          <strong>Tarik Data dari Meta API Sekarang</strong>.
        </Alert>
      )}
      {oauthErrorText && <Alert tone="error">{oauthErrorText}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: 1-Click Facebook OAuth + Dropdown Ad Account + Advanced Manual */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <PlugZap className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  1. Hubungkan Akun Meta Ads (1-Klik OAuth)
                </h2>
                <p className="text-xs text-slate-500">
                  Otomatis meminta izin baca saja (<code>ads_read</code>) & mendeteksi daftar Ad Account
                </p>
              </div>
            </div>
            {conn ? (
              tokenExpired || !tokenReadable ? (
                <Badge tone="neutral">Perlu Dihubungkan Ulang</Badge>
              ) : (
                <Badge tone="success">Terhubung</Badge>
              )
            ) : (
              <Badge tone="neutral">Belum Terhubung</Badge>
            )}
          </div>

          {/* 1-Click Facebook Login Button */}
          {canManage && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    <Sparkles className="size-3" /> Cara Paling Mudah untuk Klien
                  </span>
                  <h3 className="mt-1.5 text-xs font-bold text-slate-900">
                    Login dengan Facebook & Pilih Ad Account Otomatis
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Tanpa perlu copy-paste token atau mencari ID akun iklan secara manual.
                  </p>
                </div>

                <Link
                  href="/api/meta/oauth/start"
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#166fe5]"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {conn ? "Hubungkan Ulang via Facebook" : "Hubungkan dengan Facebook"}
                </Link>
              </div>

              {!appSecretOn && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] text-amber-900">
                  <p className="font-semibold">
                    Catatan untuk Admin Website (Setup 1x di file <code>.env</code>):
                  </p>
                  <p className="mt-0.5">
                    Agar tombol biru di atas aktif untuk semua klien, isi <code>META_APP_ID</code> dan{" "}
                    <code>META_APP_SECRET</code> di file <code>.env</code> Anda, lalu tambahkan Callback URL{" "}
                    <code className="rounded bg-white px-1 py-0.5">{callbackUrl}</code> pada menu{" "}
                    <strong>Facebook Login → Settings → Valid OAuth Redirect URIs</strong> di{" "}
                    <code>developers.facebook.com</code>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Connected Account Summary + Ad Account Dropdown Selector */}
          {conn && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600">
                <p>
                  <strong>Ad Account Aktif:</strong> {conn.adAccountName} (
                  <code>{conn.adAccountExternalId}</code>)
                </p>
                {conn.metaUserName && (
                  <p>
                    <strong>Terhubung sebagai:</strong> {conn.metaUserName}
                    {conn.metaUserId ? ` (ID ${conn.metaUserId})` : ""}
                  </p>
                )}
                <p>
                  <strong>Token Terenkripsi:</strong>{" "}
                  <code className="rounded bg-white px-1.5 py-0.5">
                    {tokenReadable ? maskedToken : "tidak bisa didekripsi — hubungkan ulang"}
                  </code>
                </p>
                <p>
                  <strong>Masa Berlaku:</strong>{" "}
                  {conn.tokenExpiresAt
                    ? `${formatDate(conn.tokenExpiresAt)}${tokenExpired ? " (KEDALUWARSA)" : ""}`
                    : appSecretOn
                      ? "Tidak kedaluwarsa (System User Token)"
                      : "Aktif"}
                </p>
                {canManage && (
                  <div className="pt-2">
                    <DisconnectMetaButton />
                  </div>
                )}
              </div>

              {/* Automatic Ad Account Dropdown if 1 or more accounts are returned by Meta */}
              {availableAccounts.length > 0 && (
                <SelectAdAccountForm
                  accounts={availableAccounts}
                  currentAccountId={conn.adAccountExternalId}
                  canManage={canManage}
                />
              )}
            </div>
          )}

          {/* Collapsible Advanced Option: Manual System User Token */}
          <details className="group mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-700">
              <span>Opsi Lanjutan: Input System User Access Token Manual (Agency / Tanpa Kedaluwarsa)</span>
              <ChevronDown className="size-4 text-slate-500 transition group-open:rotate-180" />
            </summary>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <SaveMetaConnectionForm
                defaultAccountId={conn?.adAccountExternalId}
                defaultAccountName={conn?.adAccountName}
                canManage={canManage}
              />
            </div>
          </details>
        </div>

        {/* Card 2: Sync trigger & status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Sinkronisasi Data Harian</h2>
              <p className="text-xs text-slate-500">
                Menarik Spend, Impressions, Link Clicks, Pesan, Video 3s/25%/50%, dan Permalink IG
              </p>
            </div>
          </div>

          {conn ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600">
                <p>
                  <strong>Status Terakhir:</strong> {conn.lastSyncStatus ?? "Siap"}
                </p>
                {conn.lastSyncedAt && (
                  <p className="mt-1">
                    <strong>Waktu Sync:</strong> {formatDate(conn.lastSyncedAt)}
                  </p>
                )}
              </div>
              <SyncMetaNowForm defaultSince={syncRange.since} defaultUntil={syncRange.until} />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              Klik tombol <strong>Hubungkan dengan Facebook</strong> di sebelah kiri terlebih dahulu untuk mengaktifkan penarikan data otomatis.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step-by-step guide for Owner to enable 1-click OAuth */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <KeyRound className="size-5" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              Panduan Setup Meta App (Hanya 1x oleh Pemilik Website)
            </h2>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-slate-700">
            <li>
              Buka <strong>developers.facebook.com/apps</strong> → buat App bertipe <strong>Business</strong>.
            </li>
            <li>
              Tambahkan produk <strong>Facebook Login for Business</strong> & <strong>Marketing API</strong>.
            </li>
            <li>
              Di menu <strong>Facebook Login → Settings</strong>, isi <strong>Valid OAuth Redirect URIs</strong> dengan:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">{callbackUrl}</code>
            </li>
            <li>
              Buka <strong>App Settings → Basic</strong>, salin <strong>App ID</strong> & <strong>App Secret</strong> ke file <code>.env</code> server Anda (<code>META_APP_ID</code> & <code>META_APP_SECRET</code>), lalu restart server.
            </li>
            <li>
              Sekarang semua klien yang login ke website Anda cukup klik tombol biru <strong>Hubungkan dengan Facebook</strong> dan memilih Ad Account mereka dari dropdown!
            </li>
          </ol>
        </div>

        {/* Security checklist */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Status Keamanan Koneksi</h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-xs">
            <CheckItem ok>Token dienkripsi AES-256-GCM & terisolasi per workspace</CheckItem>
            <CheckItem ok>OAuth 1-Klik dilindungi CSRF State Cookie & terkunci hanya izin baca (ads_read)</CheckItem>
            <CheckItem ok>Token dikirim lewat header Authorization (tidak pernah muncul di URL / log)</CheckItem>
            <CheckItem ok>Hanya Owner / Admin yang bisa mengubah atau menghapus koneksi</CheckItem>
            {canManage && (
              <>
                <CheckItem ok={keyStatus === "ok"}>
                  {keyStatus === "ok"
                    ? "ENCRYPTION_KEY unik sudah terpasang di server"
                    : keyStatus === "insecure_example"
                      ? "ENCRYPTION_KEY masih memakai contoh dari .env.example — WAJIB diganti"
                      : "ENCRYPTION_KEY belum diisi / tidak valid (harus 32 byte base64)"}
                </CheckItem>
                <CheckItem ok={appSecretOn}>
                  {appSecretOn
                    ? "META_APP_ID & META_APP_SECRET aktif (1-Klik Login Facebook & appsecret_proof siap)"
                    : "META_APP_ID & META_APP_SECRET belum diisi di .env (isi agar tombol 1-Klik Facebook aktif)"}
                </CheckItem>
                <CheckItem ok={httpsOn}>
                  {httpsOn
                    ? "Aplikasi berjalan di HTTPS"
                    : "APP_URL belum HTTPS (wajib HTTPS saat production di VPS)"}
                </CheckItem>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

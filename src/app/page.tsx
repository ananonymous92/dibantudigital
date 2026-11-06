import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  CloudUpload,
  Lock,
  PlugZap,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/auth/session";

export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href="/app"
                className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Buka Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Coba Gratis 7 Hari
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center lg:py-24">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="size-3.5" />
          Platform SaaS Meta Ads Reporting & ROAS Analytics
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Ubah Data Mentah Meta Ads Menjadi Dashboard ROAS Otomatis
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Tarik data langsung dari akun Meta Anda atau import laporan CSV/Excel dari Ads Manager.
          Hitung otomatis Amount Spend, Omset (Nilai Deal), ROAS, CTR, CPC, CPM, CPA, Hook Rate,
          dan AI Insights dalam satu dashboard privat untuk tiap bisnis.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={session ? "/app" : "/register"}
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {session ? "Masuk ke Dashboard" : "Mulai Free Trial 7 Hari"}
          </Link>
          <a
            href="#pricing"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Lihat Paket Langganan
          </a>
        </div>

        {/* Feature grid */}
        <div className="mt-16 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <PlugZap className="size-6 text-brand-600" />
            <h3 className="mt-3 text-sm font-bold">Koneksi Meta API Langsung</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Tarik Spend, Impressions, Link Clicks, Pesan WhatsApp/DM, Video 3s/25%/50%, dan link Instagram otomatis.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <CloudUpload className="size-6 text-emerald-600" />
            <h3 className="mt-3 text-sm font-bold">Import CSV / Excel Ads Manager</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Deteksi otomatis kolom Bahasa Indonesia, Inggris, maupun format spreadsheet manual Anda tanpa duplikat.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <BarChart3 className="size-6 text-blue-600" />
            <h3 className="mt-3 text-sm font-bold">Input Nilai Deal & ROAS Riil</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Catat omset closing dari WhatsApp/DM dan lihat ROAS, CPA, serta Hook Rate per campaign & creative.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <Lock className="size-6 text-amber-600" />
            <h3 className="mt-3 text-sm font-bold">Multi-Tenant & Privasi Penuh</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Setiap pelanggan memiliki workspace terisolasi dan token Meta dienkripsi dengan standar AES-256-GCM.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing preview (1, 3, 6, 12 months) */}
      <section id="pricing" className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-slate-900">
              Pilihan Langganan Fleksibel (1, 3, 6, atau 12 Bulan)
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Pembayaran mudah via Xendit (QRIS, Virtual Account BCA/Mandiri/BNI/BRI, E-Wallet, Kartu).
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              {
                name: "Starter",
                desc: "Untuk pemilik bisnis dengan 1 akun iklan.",
                m1: "Rp 149.000",
                m3: "Rp 425.000",
                m6: "Rp 805.000",
                m12: "Rp 1.430.000",
                items: ["1 Ad Account Meta", "1 User", "Dashboard & Grafik Lengkap", "Import CSV/XLSX & Export Excel"],
              },
              {
                name: "Pro",
                popular: true,
                desc: "Untuk advertiser & tim marketing aktif.",
                m1: "Rp 349.000",
                m3: "Rp 995.000",
                m6: "Rp 1.885.000",
                m12: "Rp 3.350.000",
                items: ["Hingga 5 Ad Account Meta", "Hingga 3 Anggota Tim", "Koneksi Meta API Otomatis", "AI Insights & Rekomendasi"],
              },
              {
                name: "Agency",
                desc: "Untuk agensi digital yang mengelola banyak klien.",
                m1: "Rp 899.000",
                m3: "Rp 2.562.000",
                m6: "Rp 4.855.000",
                m12: "Rp 8.630.000",
                items: ["Hingga 20 Ad Account Meta", "Hingga 10 Anggota Tim", "Multi-Workspace Klien", "Prioritas Support"],
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-6 ${
                  p.popular ? "border-brand-600 ring-2 ring-brand-500/20" : "border-slate-200"
                }`}
              >
                <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{p.desc}</p>
                <p className="mt-4 text-2xl font-extrabold text-slate-900">
                  {p.m1} <span className="text-xs font-normal text-slate-500">/ bulan</span>
                </p>
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                  <p>• Paket 3 Bulan (Hemat 5%): <strong>{p.m3}</strong></p>
                  <p>• Paket 6 Bulan (Hemat 10%): <strong>{p.m6}</strong></p>
                  <p>• Paket 1 Tahun (Hemat 20%): <strong>{p.m12}</strong></p>
                </div>
                <ul className="mt-5 space-y-2 text-xs text-slate-700">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-6 block w-full rounded-xl bg-brand-600 py-2.5 text-center text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Coba Gratis 7 Hari
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

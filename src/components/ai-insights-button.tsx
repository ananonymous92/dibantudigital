"use client";

import { useState } from "react";
import { Sparkles, X, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import type { ComputedMetrics } from "@/lib/metrics";
import { formatIDR } from "@/lib/utils";

type Props = {
  summary: ComputedMetrics;
  topCampaign?: { campaignName: string; roas: number; spend: number; cpa: number };
  topCreative?: { creativeLink: string; hookRate: number; roas: number };
};

export function AiInsightsButton({ summary, topCampaign, topCreative }: Props) {
  const [open, setOpen] = useState(false);

  const insights: { tone: "good" | "warn" | "tip"; title: string; detail: string }[] = [];

  if (summary.spend === 0) {
    insights.push({
      tone: "tip",
      title: "Belum ada data iklan pada periode ini",
      detail:
        "Impor laporan CSV/XLSX dari Meta Ads Manager, tarik langsung dari Meta API, atau klik 'Muat Data Contoh' untuk melihat analisis otomatis.",
    });
  } else {
    if (summary.roas >= 3) {
      insights.push({
        tone: "good",
        title: `ROAS Sangat Sehat (${summary.roas.toFixed(2)}x)`,
        detail: `Dari total belanja iklan ${formatIDR(summary.spend)}, Anda menghasilkan omset ${formatIDR(summary.purchaseValue)}. Pertimbangkan menaikkan budget 15–20% secara bertahap pada ad set pemenang.`,
      });
    } else if (summary.roas > 0 && summary.roas < 2) {
      insights.push({
        tone: "warn",
        title: `ROAS Perlu Dioptimasi (${summary.roas.toFixed(2)}x)`,
        detail: `Evaluasi follow-up pesan WhatsApp/DM atau matikan creative dengan CPA tertinggi agar biaya per closing turun.`,
      });
    } else {
      insights.push({
        tone: "tip",
        title: "Lengkapi Nilai Deal (Omset) untuk Akurasi ROAS",
        detail:
          "Masukkan Nilai Deal pada menu 'Input Data Iklan' supaya aplikasi dapat menghitung ROAS riil per campaign dan creative.",
      });
    }

    if (summary.ctr >= 2) {
      insights.push({
        tone: "good",
        title: `CTR Di Atas Rata-rata (${summary.ctr.toFixed(2)}%)`,
        detail: `Audiens merespons baik penawaran Anda (${summary.linkClicks.toLocaleString("id-ID")} link clicks dari ${summary.impressions.toLocaleString("id-ID")} tayangan).`,
      });
    } else {
      insights.push({
        tone: "warn",
        title: `CTR Masih Rendah (${summary.ctr.toFixed(2)}%)`,
        detail:
          "Uji variasi headline, thumbnail, dan 3 detik pertama video (Hook) untuk meningkatkan rasio klik.",
      });
    }

    if (summary.hookRate > 0) {
      insights.push({
        tone: summary.hookRate >= 25 ? "good" : "tip",
        title: `Hook Rate Video: ${summary.hookRate.toFixed(1)}%`,
        detail:
          topCreative
            ? `Creative terbaik Anda (${topCreative.creativeLink}) mencatat Hook Rate ${topCreative.hookRate.toFixed(1)}% dengan ROAS ${topCreative.roas.toFixed(2)}x.`
            : "Gunakan kalimat pembuka visual yang langsung menyentuh masalah utama target pasar dalam 3 detik pertama.",
      });
    }

    if (topCampaign) {
      insights.push({
        tone: "good",
        title: `Campaign Utama: ${topCampaign.campaignName}`,
        detail: `Menyerap ${formatIDR(topCampaign.spend)} dengan Cost per Result ${formatIDR(topCampaign.cpa)} dan ROAS ${topCampaign.roas.toFixed(2)}x.`,
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Sparkles className="size-4" />
        AI Insights
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">AI Insights & Rekomendasi</h3>
                  <p className="text-xs text-slate-500">
                    Analisis otomatis performa Meta Ads workspace Anda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {insights.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  {item.tone === "good" && (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  )}
                  {item.tone === "warn" && (
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                  )}
                  {item.tone === "tip" && (
                    <TrendingUp className="mt-0.5 size-5 shrink-0 text-brand-600" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


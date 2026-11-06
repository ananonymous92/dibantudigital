import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileSpreadsheet, Sparkles } from "lucide-react";
import { loadSampleDataAction, updateDealValueAction } from "@/app/actions/data";
import { ClearDataButton } from "@/components/clear-data-button";
import { getWorkspaceDashboardData } from "@/lib/insights-repo";
import { computeMetrics } from "@/lib/metrics";
import { requireWorkspace } from "@/lib/tenant";
import { formatIDR } from "@/lib/utils";
import { ImportSpreadsheetForm, ManualRowForm } from "./input-forms";

export const metadata: Metadata = { title: "Input Data Iklan & Import" };

export default async function InputDataPage() {
  const ctx = await requireWorkspace();
  const data = await getWorkspaceDashboardData({ workspaceId: ctx.workspace.id });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Import Report Meta Ads & Input Nilai Deal
          </h1>
          <p className="text-xs text-slate-500">
            Upload laporan CSV/XLSX dari Meta Ads Manager atau catat Nilai Deal (Omset) agar ROAS terhitung otomatis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {data.rows.length > 0 && <ClearDataButton />}
          <form action={loadSampleDataAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Sparkles className="size-3.5" />
              Muat Data Acuan CSV (Scuto 1–4 Nov)
            </button>
          </form>
          <Link
            href="/api/template"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="size-4" />
            Download Template Excel (.xlsx)
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Upload CSV / XLSX */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                1. Import File dari Meta Ads Manager / Spreadsheet
              </h2>
              <p className="text-xs text-slate-500">
                Otomatis mengenali kolom Bahasa Indonesia, Inggris, dan format Report Ads 2026
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ImportSpreadsheetForm />
          </div>
        </div>

        {/* Card 2: Manual entry matching Photo 5 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            2. Input Manual / Tambah Data Harian & Nilai Deal
          </h2>
          <p className="text-xs text-slate-500">
            CTR, CPC, CPM, CPA, dan ROAS dihitung otomatis oleh sistem.
          </p>
          <div className="mt-5">
            <ManualRowForm />
          </div>
        </div>
      </div>

      {/* Inline Deal Value (Omset) Editor so users can update Nilai Deal when WhatsApp leads close */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Update Cepat Nilai Deal (Omset) & ROAS per Baris Iklan ({data.rows.length} baris)
            </h2>
            <p className="text-xs text-slate-500">
              Jika data iklan ditarik dari Meta API atau CSV tanpa Nilai Deal, Anda bisa mengisi omset closing di bawah ini.
            </p>
          </div>
          {data.rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
              <span>
                Total Spend: <strong className="text-slate-900">{formatIDR(data.summary.spend)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Impresi:{" "}
                <strong className="text-slate-900">
                  {data.summary.impressions.toLocaleString("id-ID")}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Klik:{" "}
                <strong className="text-slate-900">
                  {(data.summary.linkClicks || data.summary.clicks).toLocaleString("id-ID")}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Total Pesan:{" "}
                <strong className="text-brand-700">
                  {data.summary.messages.toLocaleString("id-ID")}
                </strong>
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-2.5 pr-3">Tanggal</th>
                <th className="px-3 py-2.5">Campaign / Adset</th>
                <th className="px-3 py-2.5">Iklan & Penempatan</th>
                <th className="px-3 py-2.5 text-right">Impresi</th>
                <th className="px-3 py-2.5 text-right">Klik</th>
                <th className="px-3 py-2.5 text-right">Spend</th>
                <th className="px-3 py-2.5 text-right">Pesan</th>
                <th className="px-3 py-2.5 text-right">Nilai Deal (Omset)</th>
                <th className="py-2.5 pl-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.slice(0, 500).map((r) => {
                const m = computeMetrics({
                  spend: Number(r.spend),
                  impressions: Number(r.impressions),
                  reach: Number(r.reach),
                  clicks: Number(r.clicks),
                  linkClicks: Number(r.linkClicks),
                  messages: Number(r.messages),
                  results: Number(r.results),
                  video3s: Number(r.video3s),
                  videoP25: Number(r.videoP25),
                  videoP50: Number(r.videoP50),
                  videoP75: Number(r.videoP75),
                  videoP100: Number(r.videoP100),
                  purchaseValue: Number(r.purchaseValue),
                });
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-slate-700">{r.date}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-900">{r.campaignName}</p>
                      <p className="text-[11px] text-slate-500">{r.adsetName}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800">{r.adName || "-"}</p>
                      <span className="mt-0.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {r.publisherPlatform}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {m.impressions.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {(m.linkClicks || m.clicks).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900">
                      {formatIDR(m.spend)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                      {m.messages}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <form
                        action={updateDealValueAction}
                        className="inline-flex items-center justify-end gap-1.5"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="number"
                          name="purchaseValue"
                          defaultValue={m.purchaseValue}
                          className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs font-semibold text-emerald-700"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
                        >
                          Simpan
                        </button>
                      </form>
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold text-blue-600">
                      {m.roas.toFixed(2)}x
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


import type { Metadata } from "next";
import Link from "next/link";
import { CloudUpload, Download } from "lucide-react";
import { ClearDataButton } from "@/components/clear-data-button";
import { PerformanceTables } from "@/components/performance-tables";
import { getWorkspaceDashboardData } from "@/lib/insights-repo";
import { requireWorkspace } from "@/lib/tenant";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage() {
  const ctx = await requireWorkspace();
  const data = await getWorkspaceDashboardData({ workspaceId: ctx.workspace.id });

  const serializedRows = data.rows.map((r) => ({
    id: r.id,
    date: r.date,
    campaignName: r.campaignName,
    adsetName: r.adsetName,
    adName: r.adName,
    creativeUrl: r.creativeUrl,
    publisherPlatform: r.publisherPlatform,
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
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Campaign & Creative Performance</h1>
          <p className="text-xs text-slate-500">
            Ringkasan performa per Campaign, Ad Set, Creative Link, hingga tabel laporan harian lengkap dengan filter & rentang tanggal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {serializedRows.length > 0 && <ClearDataButton />}
          <Link
            href="/app/input"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <CloudUpload className="size-4" />
            Import CSV / Excel
          </Link>
          <Link
            href="/api/export"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Download className="size-4" />
            Download Report Excel (.xlsx)
          </Link>
        </div>
      </div>

      <PerformanceTables rows={serializedRows} />
    </div>
  );
}

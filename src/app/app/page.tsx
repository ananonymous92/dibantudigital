import Link from "next/link";
import {
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  CloudUpload,
  Database,
} from "lucide-react";
import { loadSampleDataAction } from "@/app/actions/data";
import { AiInsightsButton } from "@/components/ai-insights-button";
import { ClearDataButton } from "@/components/clear-data-button";
import { TimeSeriesChartsGrid } from "@/components/charts";
import { getWorkspaceDashboardData } from "@/lib/insights-repo";
import {
  formatCompactNumber,
  formatPercent,
  formatRoas,
  pctChange,
} from "@/lib/metrics";
import { requireWorkspace } from "@/lib/tenant";
import { formatIDR } from "@/lib/utils";

function DeltaBadge({
  current,
  previous,
  invertColor = false,
}: {
  current: number;
  previous: number;
  invertColor?: boolean;
}) {
  const delta = pctChange(current, previous);
  if (delta === null) {
    return <p className="mt-2 text-xs font-medium text-slate-400">— periode pertama</p>;
  }
  const isUp = delta >= 0;
  const isGood = invertColor ? !isUp : isUp;
  return (
    <p
      className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
        isGood ? "text-emerald-600" : "text-red-500"
      }`}
    >
      <span>{isUp ? "▲" : "▼"}</span>
      <span>{Math.abs(delta).toFixed(1)}%</span>
    </p>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string; until?: string; adset?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireWorkspace();
  const data = await getWorkspaceDashboardData({
    workspaceId: ctx.workspace.id,
    since: params.since,
    until: params.until,
    adset: params.adset,
  });

  const { summary: s, previousSummary: prev } = data;
  const effectiveClicks = s.linkClicks || s.clicks;
  const prevClicks = prev.linkClicks || prev.clicks;

  return (
    <div className="space-y-6">
      {/* Top header bar matching Photo 1 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#1877F2] text-base font-bold text-white">
            f
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Facebook Ads (Meta Ads)</h1>
            <p className="text-xs text-slate-500">
              Workspace: <span className="font-semibold text-slate-700">{ctx.workspace.name}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date & Ad Set filter form */}
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <Calendar className="size-3.5 text-slate-400" />
              <input
                type="date"
                name="since"
                defaultValue={params.since ?? ""}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400">—</span>
              <input
                type="date"
                name="until"
                defaultValue={params.until ?? ""}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <Filter className="size-3.5 text-slate-400" />
              <select
                name="adset"
                defaultValue={params.adset ?? "all"}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">Semua Ad Set</option>
                {data.adsets.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Terapkan
            </button>
          </form>

          <Link
            href="/api/export"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="size-3.5" />
            Export Excel
          </Link>

          <AiInsightsButton
            summary={s}
            topCampaign={data.byCampaign[0]}
            topCreative={data.byCreative[0]}
          />
        </div>
      </div>

      {/* Sync status banner matching Photo 1 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span>Dashboard telah disinkronkan & diperbarui</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/app/input" className="font-semibold text-emerald-900 underline">
            + Import CSV/XLSX atau Input Nilai Deal
          </Link>
          {data.rows.length > 0 ? (
            <ClearDataButton />
          ) : (
            <form action={loadSampleDataAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <Database className="size-3.5" />
                Muat Data Contoh (Demo)
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 8 KPI Cards (2 rows x 4 columns) matching Photo 1 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Amount spend</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {formatIDR(s.spend)}
          </p>
          <DeltaBadge current={s.spend} previous={prev.spend} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Omset (Revenue)</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-600">
            {formatIDR(s.purchaseValue)}
          </p>
          <DeltaBadge current={s.purchaseValue} previous={prev.purchaseValue} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">ROAS</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-blue-600">
            {formatRoas(s.roas)}
          </p>
          <DeltaBadge current={s.roas} previous={prev.roas} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Impressions</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {formatCompactNumber(s.impressions)}
          </p>
          <DeltaBadge current={s.impressions} previous={prev.impressions} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Link clicks</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {effectiveClicks.toLocaleString("id-ID")}
          </p>
          <DeltaBadge current={effectiveClicks} previous={prevClicks} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">CTR (Click Rate)</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {formatPercent(s.ctr, 1)}
          </p>
          <DeltaBadge current={s.ctr} previous={prev.ctr} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Pesan Percakapan</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {s.messages.toLocaleString("id-ID")}
          </p>
          <DeltaBadge current={s.messages} previous={prev.messages} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Cost per Result</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {formatIDR(s.cpa)}
          </p>
          <DeltaBadge current={s.cpa} previous={prev.cpa} invertColor />
        </div>
      </div>

      {/* Empty-state helper if workspace has no data yet */}
      {data.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CloudUpload className="mx-auto size-10 text-brand-600" />
          <h2 className="mt-3 text-base font-bold text-slate-900">
            Workspace Anda siap digunakan
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Anda dapat langsung mengimpor file CSV/XLSX dari Meta Ads Manager, menghubungkan akun Meta API secara langsung, atau memuat data contoh sesuai format referensi Anda.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <form action={loadSampleDataAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                <Database className="size-4" />
                Muat Data Contoh (Appasco Report 2026)
              </button>
            </form>
            <Link
              href="/app/input"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CloudUpload className="size-4" />
              Upload CSV / Excel Ads Manager
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 4 Time-Series Charts matching Photo 2 */}
          <TimeSeriesChartsGrid series={data.dailySeries} />

          {/* Source & Campaign Type Breakdown matching Photo 3 */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Source table with heatmap styling */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Performance by Source / Placement Platform
              </h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2.5 pr-3">Source</th>
                      <th className="px-3 py-2.5 text-right">Impressions</th>
                      <th className="px-3 py-2.5 text-right">Clicks</th>
                      <th className="px-3 py-2.5 text-right">CTR</th>
                      <th className="py-2.5 pl-3 text-right">Amount spent ↓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byPlatform.map((p) => (
                      <tr key={p.platform}>
                        <td className="py-2.5 pr-3 font-medium text-slate-800">{p.platform}</td>
                        <td className="bg-slate-100/80 px-3 py-2.5 text-right font-medium text-slate-800">
                          {p.impressions.toLocaleString("id-ID")}
                        </td>
                        <td className="bg-sky-50 px-3 py-2.5 text-right font-medium text-sky-900">
                          {(p.linkClicks || p.clicks).toLocaleString("id-ID")}
                        </td>
                        <td className="bg-purple-50 px-3 py-2.5 text-right font-medium text-purple-900">
                          {p.ctr.toFixed(2)}%
                        </td>
                        <td className="bg-amber-50 py-2.5 pl-3 text-right font-semibold text-amber-950">
                          {formatIDR(p.spend)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold text-slate-900">
                      <td className="pt-2.5 pr-3">Grand total</td>
                      <td className="px-3 pt-2.5 text-right">
                        {s.impressions.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 pt-2.5 text-right">
                        {effectiveClicks.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 pt-2.5 text-right">{s.ctr.toFixed(2)}%</td>
                      <td className="pt-2.5 pl-3 text-right">{formatIDR(s.spend)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Amount spent by Campaign Type / Objective */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Amount spent by Campaign type & ROAS
              </h3>
              <div className="mt-4 space-y-3">
                {data.byObjective.map((o) => {
                  const pct = s.spend > 0 ? Math.round((o.spend / s.spend) * 100) : 0;
                  return (
                    <div key={o.objective} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{o.objective}</span>
                        <span className="text-slate-600">
                          {formatIDR(o.spend)} · CPC {formatIDR(o.cpc)} · ROAS{" "}
                          <strong className="text-blue-600">{o.roas.toFixed(2)}x</strong>
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getWorkspaceDashboardData } from "@/lib/insights-repo";
import { computeMetrics } from "@/lib/metrics";
import { requireWorkspace } from "@/lib/tenant";

/**
 * Export the current workspace's report data in the exact column layout of
 * Photo 5 (Report Ads 2026: Tanggal, Campaign, Adset, Creative, Amount Spend,
 * Impression, Click, CTR, CPC, CPM, MESSAGE, CPA, Hook Rate, Iklan Ditonton 25%,
 * Iklan Ditonton 50%, Nilai Deal, ROAS).
 */
export async function GET() {
  const ctx = await requireWorkspace();
  const data = await getWorkspaceDashboardData({ workspaceId: ctx.workspace.id });

  const sheetRows = data.rows.map((r) => {
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

    return {
      Tanggal: r.date,
      Campaign: r.campaignName,
      Adset: r.adsetName,
      Creative: r.creativeUrl ?? r.adName,
      Penempatan: r.publisherPlatform,
      "Amount Spend": m.spend,
      Impression: m.impressions,
      Click: m.linkClicks || m.clicks,
      CTR: `${m.ctr.toFixed(2)}%`,
      CPC: Math.round(m.cpc),
      CPM: Math.round(m.cpm),
      MESSAGE: m.messages,
      CPA: Math.round(m.cpa),
      "Hook Rate": `${m.hookRate.toFixed(1)}%`,
      "Iklan Ditonton 25%": m.videoP25,
      "Iklan Ditonton 50%": m.videoP50,
      "Nilai Deal": m.purchaseValue,
      ROAS: `${m.roas.toFixed(2)}x`,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, "Report Ads");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Report-Ads-${ctx.workspace.slug}.xlsx"`,
    },
  });
}


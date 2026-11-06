import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  normalizeSpreadsheetRows,
  readSpreadsheetBuffer,
  type NormalizedInsightRow,
} from "@/lib/import-parser";
import { computeMetrics, emptyRawMetrics, sumRawMetrics, type ComputedMetrics } from "@/lib/metrics";
import { SAMPLE_META_CSV } from "@/lib/sample-scuto-csv";

export async function upsertInsightRows(params: {
  workspaceId: string;
  accountExternalId: string;
  accountName: string;
  source: "meta_api" | "import";
  rows: NormalizedInsightRow[];
  replaceExisting?: boolean;
}): Promise<{ count: number; adAccountId: string }> {
  const { workspaceId, accountExternalId, accountName, source, rows, replaceExisting = false } = params;

  if (replaceExisting) {
    await db()
      .delete(schema.adInsightsDaily)
      .where(eq(schema.adInsightsDaily.workspaceId, workspaceId));
  }

  const [account] = await db()
    .insert(schema.adAccounts)
    .values({
      workspaceId,
      source,
      externalId: accountExternalId,
      name: accountName,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.adAccounts.workspaceId, schema.adAccounts.externalId],
      set: {
        name: accountName,
        lastSyncedAt: new Date(),
      },
    })
    .returning({ id: schema.adAccounts.id });

  if (rows.length === 0) {
    return { count: 0, adAccountId: account.id };
  }

  // Merge rows with identical rowKey within the same batch by summing metrics (never dropping spend)
  const byKey = new Map<string, NormalizedInsightRow>();
  for (const r of rows) {
    const existing = byKey.get(r.rowKey);
    if (!existing) {
      byKey.set(r.rowKey, { ...r });
    } else {
      existing.spend += r.spend;
      existing.impressions += r.impressions;
      existing.reach += r.reach;
      existing.clicks += r.clicks;
      existing.linkClicks += r.linkClicks;
      existing.messages += r.messages;
      existing.results += r.results;
      existing.video3s += r.video3s;
      existing.videoP25 += r.videoP25;
      existing.videoP50 += r.videoP50;
      existing.videoP75 += r.videoP75;
      existing.videoP100 += r.videoP100;
      existing.purchaseValue += r.purchaseValue;
    }
  }
  const uniqueRows = Array.from(byKey.values());

  await db()
    .insert(schema.adInsightsDaily)
    .values(
      uniqueRows.map((r) => ({
        workspaceId,
        adAccountId: account.id,
        date: r.date,
        rowKey: r.rowKey,
        campaignName: r.campaignName,
        adsetName: r.adsetName,
        adName: r.adName,
        creativeUrl: r.creativeUrl,
        spend: r.spend,
        impressions: r.impressions,
        reach: r.reach,
        clicks: r.clicks,
        linkClicks: r.linkClicks,
        messages: r.messages,
        results: r.results,
        video3s: r.video3s,
        videoP25: r.videoP25,
        videoP50: r.videoP50,
        videoP75: r.videoP75,
        videoP100: r.videoP100,
        purchaseValue: r.purchaseValue,
        publisherPlatform: r.publisherPlatform,
        objective: r.objective,
        ageRange: r.ageRange,
        gender: r.gender,
        source,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.adInsightsDaily.adAccountId, schema.adInsightsDaily.rowKey],
      set: {
        campaignName: sql`excluded.campaign_name`,
        adsetName: sql`excluded.adset_name`,
        adName: sql`excluded.ad_name`,
        creativeUrl: sql`excluded.creative_url`,
        spend: sql`excluded.spend`,
        impressions: sql`excluded.impressions`,
        reach: sql`excluded.reach`,
        clicks: sql`excluded.clicks`,
        linkClicks: sql`excluded.link_clicks`,
        messages: sql`excluded.messages`,
        results: sql`excluded.results`,
        video3s: sql`excluded.video_3s`,
        videoP25: sql`excluded.video_p25`,
        videoP50: sql`excluded.video_p50`,
        videoP75: sql`excluded.video_p75`,
        videoP100: sql`excluded.video_p100`,
        purchaseValue: sql`excluded.purchase_value`,
        publisherPlatform: sql`excluded.publisher_platform`,
        objective: sql`excluded.objective`,
        ageRange: sql`excluded.age_range`,
        gender: sql`excluded.gender`,
        source: sql`excluded.source`,
        updatedAt: new Date(),
      },
    });

  return { count: uniqueRows.length, adAccountId: account.id };
}

export type DashboardData = {
  rows: (typeof schema.adInsightsDaily.$inferSelect)[];
  adsets: string[];
  campaigns: string[];
  summary: ComputedMetrics;
  previousSummary: ComputedMetrics;
  dailySeries: (ComputedMetrics & { date: string; label: string })[];
  byCampaign: (ComputedMetrics & { campaignName: string; adsetName: string })[];
  byCreative: (ComputedMetrics & { creativeLink: string; adName: string; campaignName: string })[];
  byPlatform: (ComputedMetrics & { platform: string })[];
  byObjective: (ComputedMetrics & { objective: string })[];
  byAudience: (ComputedMetrics & { ageRange: string; gender: string })[];
  lastSyncedAt: Date | null;
};

export async function getWorkspaceDashboardData(params: {
  workspaceId: string;
  since?: string;
  until?: string;
  adset?: string;
}): Promise<DashboardData> {
  const { workspaceId, since, until, adset } = params;

  const allRows = await db()
    .select()
    .from(schema.adInsightsDaily)
    .where(eq(schema.adInsightsDaily.workspaceId, workspaceId))
    .orderBy(asc(schema.adInsightsDaily.date), desc(schema.adInsightsDaily.spend));

  const accounts = await db()
    .select({ lastSyncedAt: schema.adAccounts.lastSyncedAt })
    .from(schema.adAccounts)
    .where(eq(schema.adAccounts.workspaceId, workspaceId))
    .orderBy(desc(schema.adAccounts.lastSyncedAt))
    .limit(1);

  const adsets = Array.from(new Set(allRows.map((r) => r.adsetName).filter(Boolean))).sort();
  const campaigns = Array.from(new Set(allRows.map((r) => r.campaignName).filter(Boolean))).sort();

  const filtered = allRows.filter((r) => {
    if (since && r.date < since) return false;
    if (until && r.date > until) return false;
    if (adset && adset !== "all" && r.adsetName !== adset) return false;
    return true;
  });

  // Compute previous period for delta badges
  let prevRows: typeof allRows = [];
  if (since && until) {
    const startMs = new Date(since).getTime();
    const endMs = new Date(until).getTime();
    const spanMs = Math.max(86_400_000, endMs - startMs + 86_400_000);
    const prevUntil = new Date(startMs - 86_400_000).toISOString().slice(0, 10);
    const prevSince = new Date(startMs - spanMs).toISOString().slice(0, 10);
    prevRows = allRows.filter(
      (r) =>
        r.date >= prevSince &&
        r.date <= prevUntil &&
        (!adset || adset === "all" || r.adsetName === adset),
    );
  } else if (filtered.length > 1) {
    const mid = Math.floor(filtered.length / 2);
    prevRows = filtered.slice(0, mid);
  }

  const summary = computeMetrics(sumRawMetrics(filtered));
  const previousSummary = computeMetrics(
    prevRows.length > 0 ? sumRawMetrics(prevRows) : emptyRawMetrics(),
  );

  // Group by date
  const dateMap = new Map<string, typeof filtered>();
  for (const r of filtered) {
    const list = dateMap.get(r.date) ?? [];
    list.push(r);
    dateMap.set(r.date, list);
  }
  const dailySeries = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const d = new Date(`${date}T00:00:00Z`);
      const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
      return { date, label, ...computeMetrics(sumRawMetrics(list)) };
    });

  // Group by Campaign + Ad Set
  const campMap = new Map<string, { campaignName: string; adsetName: string; list: typeof filtered }>();
  for (const r of filtered) {
    const key = `${r.campaignName}||${r.adsetName}`;
    const existing = campMap.get(key) ?? {
      campaignName: r.campaignName,
      adsetName: r.adsetName,
      list: [],
    };
    existing.list.push(r);
    campMap.set(key, existing);
  }
  const byCampaign = Array.from(campMap.values())
    .map((g) => ({
      campaignName: g.campaignName,
      adsetName: g.adsetName,
      ...computeMetrics(sumRawMetrics(g.list)),
    }))
    .sort((a, b) => b.spend - a.spend);

  // Group by Creative
  const creativeMap = new Map<
    string,
    { creativeLink: string; adName: string; campaignName: string; list: typeof filtered }
  >();
  for (const r of filtered) {
    const creativeLink = r.creativeUrl || r.adName || r.adsetName;
    const existing = creativeMap.get(creativeLink) ?? {
      creativeLink,
      adName: r.adName || creativeLink,
      campaignName: r.campaignName,
      list: [],
    };
    existing.list.push(r);
    creativeMap.set(creativeLink, existing);
  }
  const byCreative = Array.from(creativeMap.values())
    .map((g) => ({
      creativeLink: g.creativeLink,
      adName: g.adName,
      campaignName: g.campaignName,
      ...computeMetrics(sumRawMetrics(g.list)),
    }))
    .sort((a, b) => b.spend - a.spend);

  // Group by Platform / Source
  const platMap = new Map<string, typeof filtered>();
  for (const r of filtered) {
    const p = r.publisherPlatform || "Facebook Ads";
    const list = platMap.get(p) ?? [];
    list.push(r);
    platMap.set(p, list);
  }
  const byPlatform = Array.from(platMap.entries())
    .map(([platform, list]) => ({ platform, ...computeMetrics(sumRawMetrics(list)) }))
    .sort((a, b) => b.spend - a.spend);

  // Group by Objective / Campaign type
  const objMap = new Map<string, typeof filtered>();
  for (const r of filtered) {
    const o = r.objective || "Conversions";
    const list = objMap.get(o) ?? [];
    list.push(r);
    objMap.set(o, list);
  }
  const byObjective = Array.from(objMap.entries())
    .map(([objective, list]) => ({ objective, ...computeMetrics(sumRawMetrics(list)) }))
    .sort((a, b) => b.spend - a.spend);

  // Group by Audience (Age + Gender)
  const audMap = new Map<string, { ageRange: string; gender: string; list: typeof filtered }>();
  for (const r of filtered) {
    const ageRange = r.ageRange || "25-34";
    const gender = r.gender || "All";
    const key = `${ageRange}||${gender}`;
    const existing = audMap.get(key) ?? { ageRange, gender, list: [] };
    existing.list.push(r);
    audMap.set(key, existing);
  }
  const byAudience = Array.from(audMap.values())
    .map((g) => ({
      ageRange: g.ageRange,
      gender: g.gender,
      ...computeMetrics(sumRawMetrics(g.list)),
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    rows: filtered,
    adsets,
    campaigns,
    summary,
    previousSummary,
    dailySeries,
    byCampaign,
    byCreative,
    byPlatform,
    byObjective,
    byAudience,
    lastSyncedAt: accounts[0]?.lastSyncedAt ?? null,
  };
}

/**
 * Sample dataset built directly from the user's real Meta Ads Manager CSV
 * (`Report-Scuto-Pusat-1-4_Nov_2026.csv`, 148 rows across 2026-11-01 to 2026-11-04).
 */
export function buildSampleInsightRows(): NormalizedInsightRow[] {
  const { rows } = readSpreadsheetBuffer(Buffer.from(SAMPLE_META_CSV, "utf8"));
  return normalizeSpreadsheetRows(rows);
}


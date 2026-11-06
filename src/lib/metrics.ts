/**
 * Pure calculation utilities for Meta Ads metrics (matches the user's manual
 * report columns: Amount Spend, Impression, Click, CTR, CPC, CPM, MESSAGE, CPA,
 * Hook Rate, Iklan Ditonton 25%, Iklan Ditonton 50%, Nilai Deal, ROAS).
 */

export type RawMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  messages: number;
  results: number;
  video3s: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP100: number;
  purchaseValue: number;
};

export type ComputedMetrics = RawMetrics & {
  ctr: number; // percentage, e.g. 4.1 means 4.1%
  cpc: number; // IDR per click
  cpm: number; // IDR per 1,000 impressions
  cpa: number; // IDR per message/result (Cost per Result)
  hookRate: number; // percentage: 3-second video views / impressions * 100
  roas: number; // multiplier: purchaseValue / spend (e.g. 3.55x)
};

export function emptyRawMetrics(): RawMetrics {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    linkClicks: 0,
    messages: 0,
    results: 0,
    video3s: 0,
    videoP25: 0,
    videoP50: 0,
    videoP75: 0,
    videoP100: 0,
    purchaseValue: 0,
  };
}

export function sumRawMetrics(rows: Partial<RawMetrics>[]): RawMetrics {
  const acc = emptyRawMetrics();
  for (const r of rows) {
    acc.spend += Number(r.spend ?? 0);
    acc.impressions += Number(r.impressions ?? 0);
    acc.reach += Number(r.reach ?? 0);
    acc.clicks += Number(r.clicks ?? 0);
    acc.linkClicks += Number(r.linkClicks ?? 0);
    acc.messages += Number(r.messages ?? 0);
    acc.results += Number(r.results ?? 0);
    acc.video3s += Number(r.video3s ?? 0);
    acc.videoP25 += Number(r.videoP25 ?? 0);
    acc.videoP50 += Number(r.videoP50 ?? 0);
    acc.videoP75 += Number(r.videoP75 ?? 0);
    acc.videoP100 += Number(r.videoP100 ?? 0);
    acc.purchaseValue += Number(r.purchaseValue ?? 0);
  }
  return acc;
}

export function computeMetrics(raw: RawMetrics): ComputedMetrics {
  const effectiveClicks = raw.linkClicks > 0 ? raw.linkClicks : raw.clicks;
  const ctr = raw.impressions > 0 ? (effectiveClicks / raw.impressions) * 100 : 0;
  const cpc = effectiveClicks > 0 ? raw.spend / effectiveClicks : 0;
  const cpm = raw.impressions > 0 ? (raw.spend / raw.impressions) * 1000 : 0;
  const effectiveResults = raw.messages > 0 ? raw.messages : raw.results;
  const cpa = effectiveResults > 0 ? raw.spend / effectiveResults : 0;
  const hookRate = raw.impressions > 0 ? (raw.video3s / raw.impressions) * 100 : 0;
  const roas = raw.spend > 0 ? raw.purchaseValue / raw.spend : 0;

  return {
    ...raw,
    ctr,
    cpc,
    cpm,
    cpa,
    hookRate,
    roas,
  };
}

/** Percentage change from `previous` to `current` (e.g. +25.4 or -12.2). */
export function pctChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatRoas(value: number): string {
  return `${value.toFixed(2)}x`;
}


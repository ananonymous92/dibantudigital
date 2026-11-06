"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ExternalLink,
  Filter,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  computeMetrics,
  sumRawMetrics,
  type ComputedMetrics,
} from "@/lib/metrics";
import { formatIDR } from "@/lib/utils";

export type InsightRowItem = {
  id: number;
  date: string;
  campaignName: string;
  adsetName: string;
  adName: string;
  creativeUrl: string | null;
  publisherPlatform?: string;
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

type MetricSortKey =
  | "date"
  | "name"
  | "subname"
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "messages"
  | "cpa"
  | "hookRate"
  | "videoP25"
  | "videoP50"
  | "purchaseValue"
  | "roas";

type SortState = {
  key: MetricSortKey;
  dir: "asc" | "desc";
};

function SortHeader({
  label,
  sortKey,
  sort,
  onToggle,
  align = "right",
  lightText = false,
}: {
  label: string;
  sortKey: MetricSortKey;
  sort: SortState;
  onToggle: (key: MetricSortKey) => void;
  align?: "left" | "right";
  lightText?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`px-3 py-2.5 select-none ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 font-bold tracking-wider uppercase transition ${
          lightText
            ? "text-[11px] text-white hover:text-amber-200"
            : active
              ? "text-[11px] text-brand-600"
              : "text-[11px] text-slate-500 hover:text-slate-900"
        }`}
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3 shrink-0" />
          ) : (
            <ArrowDown className="size-3 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="size-3 shrink-0 opacity-40" />
        )}
      </button>
    </th>
  );
}

function compareMetricRow(
  a: ComputedMetrics & { date?: string; name: string; subname: string },
  b: ComputedMetrics & { date?: string; name: string; subname: string },
  sort: SortState,
): number {
  const mul = sort.dir === "asc" ? 1 : -1;
  switch (sort.key) {
    case "date":
      return (a.date ?? "").localeCompare(b.date ?? "") * mul;
    case "name":
      return a.name.localeCompare(b.name) * mul;
    case "subname":
      return a.subname.localeCompare(b.subname) * mul;
    case "clicks":
      return ((a.linkClicks || a.clicks) - (b.linkClicks || b.clicks)) * mul;
    default: {
      const va = Number(a[sort.key] ?? 0);
      const vb = Number(b[sort.key] ?? 0);
      return (va - vb) * mul;
    }
  }
}

export function PerformanceTables({ rows }: { rows: InsightRowItem[] }) {
  // Unique dates, campaigns, adsets for dropdown filters
  const availableDates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.date))).sort(),
    [rows],
  );
  const availableCampaigns = useMemo(
    () => Array.from(new Set(rows.map((r) => r.campaignName))).sort(),
    [rows],
  );
  const availableAdsets = useMemo(
    () => Array.from(new Set(rows.map((r) => r.adsetName))).sort(),
    [rows],
  );

  // Global Date Filter state (shared default, or user can pick a single day / date range)
  const [dateMode, setDateMode] = useState<"range" | "single">("range");
  const [globalSince, setGlobalSince] = useState<string>("");
  const [globalUntil, setGlobalUntil] = useState<string>("");
  const [singleDate, setSingleDate] = useState<string>("");

  // Section 1: Campaign performance filters & sort
  const [campGroupByDay, setCampGroupByDay] = useState<boolean>(false);
  const [campSearch, setCampSearch] = useState<string>("");
  const [campFilterCampaign, setCampFilterCampaign] = useState<string>("all");
  const [campFilterAdset, setCampFilterAdset] = useState<string>("all");
  const [campSince, setCampSince] = useState<string>("");
  const [campUntil, setCampUntil] = useState<string>("");
  const [campSort, setCampSort] = useState<SortState>({ key: "spend", dir: "desc" });

  // Section 2: Creative Performance filters & sort
  const [creGroupByDay, setCreGroupByDay] = useState<boolean>(false);
  const [creSearch, setCreSearch] = useState<string>("");
  const [creFilterCampaign, setCreFilterCampaign] = useState<string>("all");
  const [creSince, setCreSince] = useState<string>("");
  const [creUntil, setCreUntil] = useState<string>("");
  const [creSort, setCreSort] = useState<SortState>({ key: "spend", dir: "desc" });

  // Section 3: Daily Full Table (Report Ads 2026) filters & sort
  const [dailySearch, setDailySearch] = useState<string>("");
  const [dailyFilterCampaign, setDailyFilterCampaign] = useState<string>("all");
  const [dailyFilterAdset, setDailyFilterAdset] = useState<string>("all");
  const [dailySince, setDailySince] = useState<string>("");
  const [dailyUntil, setDailyUntil] = useState<string>("");
  const [dailySort, setDailySort] = useState<SortState>({ key: "date", dir: "desc" });

  // Helper to apply global + local date filters
  function matchesDateRange(rowDate: string, localSince: string, localUntil: string): boolean {
    if (dateMode === "single" && singleDate) {
      if (rowDate !== singleDate) return false;
    } else {
      if (globalSince && rowDate < globalSince) return false;
      if (globalUntil && rowDate > globalUntil) return false;
    }
    if (localSince && rowDate < localSince) return false;
    if (localUntil && rowDate > localUntil) return false;
    return true;
  }

  function toggleSort(current: SortState, key: MetricSortKey): SortState {
    if (current.key === key) {
      return { key, dir: current.dir === "desc" ? "asc" : "desc" };
    }
    return { key, dir: "desc" };
  }

  // 1. Compute Campaign Performance rows
  const campaignRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesDateRange(r.date, campSince, campUntil)) return false;
      if (campFilterCampaign !== "all" && r.campaignName !== campFilterCampaign) return false;
      if (campFilterAdset !== "all" && r.adsetName !== campFilterAdset) return false;
      if (campSearch.trim()) {
        const q = campSearch.toLowerCase();
        if (
          !r.campaignName.toLowerCase().includes(q) &&
          !r.adsetName.toLowerCase().includes(q) &&
          !r.date.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    const groups = new Map<
      string,
      { date?: string; campaignName: string; adsetName: string; list: InsightRowItem[] }
    >();

    for (const r of filtered) {
      const key = campGroupByDay
        ? `${r.date}||${r.campaignName}||${r.adsetName}`
        : `${r.campaignName}||${r.adsetName}`;
      const existing = groups.get(key) ?? {
        date: campGroupByDay ? r.date : undefined,
        campaignName: r.campaignName,
        adsetName: r.adsetName,
        list: [],
      };
      existing.list.push(r);
      groups.set(key, existing);
    }

    const mapped = Array.from(groups.values()).map((g) => ({
      date: g.date,
      name: g.campaignName,
      subname: g.adsetName,
      campaignName: g.campaignName,
      adsetName: g.adsetName,
      ...computeMetrics(sumRawMetrics(g.list)),
    }));

    mapped.sort((a, b) => compareMetricRow(a, b, campSort));
    return { items: mapped, total: computeMetrics(sumRawMetrics(filtered)) };
  }, [
    rows,
    dateMode,
    singleDate,
    globalSince,
    globalUntil,
    campSince,
    campUntil,
    campFilterCampaign,
    campFilterAdset,
    campSearch,
    campGroupByDay,
    campSort,
  ]);

  // 2. Compute Creative Performance rows
  const creativeRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesDateRange(r.date, creSince, creUntil)) return false;
      if (creFilterCampaign !== "all" && r.campaignName !== creFilterCampaign) return false;
      if (creSearch.trim()) {
        const q = creSearch.toLowerCase();
        const link = (r.creativeUrl ?? r.adName).toLowerCase();
        if (
          !link.includes(q) &&
          !r.campaignName.toLowerCase().includes(q) &&
          !r.adsetName.toLowerCase().includes(q) &&
          !r.date.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    const groups = new Map<
      string,
      {
        date?: string;
        creativeLink: string;
        campaignName: string;
        adsetName: string;
        list: InsightRowItem[];
      }
    >();

    for (const r of filtered) {
      const creativeLink = r.creativeUrl || r.adName || r.adsetName;
      const key = creGroupByDay ? `${r.date}||${creativeLink}` : creativeLink;
      const existing = groups.get(key) ?? {
        date: creGroupByDay ? r.date : undefined,
        creativeLink,
        campaignName: r.campaignName,
        adsetName: r.adsetName,
        list: [],
      };
      existing.list.push(r);
      groups.set(key, existing);
    }

    const mapped = Array.from(groups.values()).map((g) => ({
      date: g.date,
      name: g.creativeLink,
      subname: `${g.campaignName} · ${g.adsetName}`,
      creativeLink: g.creativeLink,
      campaignName: g.campaignName,
      adsetName: g.adsetName,
      ...computeMetrics(sumRawMetrics(g.list)),
    }));

    mapped.sort((a, b) => compareMetricRow(a, b, creSort));
    return { items: mapped, total: computeMetrics(sumRawMetrics(filtered)) };
  }, [
    rows,
    dateMode,
    singleDate,
    globalSince,
    globalUntil,
    creSince,
    creUntil,
    creFilterCampaign,
    creSearch,
    creGroupByDay,
    creSort,
  ]);

  // 3. Compute Daily Full Table rows (Report Ads 2026)
  const dailyRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesDateRange(r.date, dailySince, dailyUntil)) return false;
      if (dailyFilterCampaign !== "all" && r.campaignName !== dailyFilterCampaign) return false;
      if (dailyFilterAdset !== "all" && r.adsetName !== dailyFilterAdset) return false;
      if (dailySearch.trim()) {
        const q = dailySearch.toLowerCase();
        const link = (r.creativeUrl ?? r.adName).toLowerCase();
        const plat = (r.publisherPlatform ?? "").toLowerCase();
        if (
          !r.date.includes(q) &&
          !r.campaignName.toLowerCase().includes(q) &&
          !r.adsetName.toLowerCase().includes(q) &&
          !link.includes(q) &&
          !plat.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    const mapped = filtered.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.campaignName,
      subname: r.adsetName,
      campaignName: r.campaignName,
      adsetName: r.adsetName,
      creativeLink: r.creativeUrl ?? r.adName,
      publisherPlatform: r.publisherPlatform ?? "",
      ...computeMetrics({
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
      }),
    }));

    mapped.sort((a, b) => compareMetricRow(a, b, dailySort));
    return { items: mapped, total: computeMetrics(sumRawMetrics(filtered)) };
  }, [
    rows,
    dateMode,
    singleDate,
    globalSince,
    globalUntil,
    dailySince,
    dailyUntil,
    dailyFilterCampaign,
    dailyFilterAdset,
    dailySearch,
    dailySort,
  ]);

  function resetAllFilters() {
    setDateMode("range");
    setGlobalSince("");
    setGlobalUntil("");
    setSingleDate("");
    setCampSearch("");
    setCampFilterCampaign("all");
    setCampFilterAdset("all");
    setCampSince("");
    setCampUntil("");
    setCreSearch("");
    setCreFilterCampaign("all");
    setCreSince("");
    setCreUntil("");
    setDailySearch("");
    setDailyFilterCampaign("all");
    setDailyFilterAdset("all");
    setDailySince("");
    setDailyUntil("");
  }

  return (
    <div className="space-y-6">
      {/* Global Date Range / Per-Day Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Calendar className="size-4 text-brand-600" />
              Filter Tanggal Utama:
            </span>

            {/* Toggle Rentang Tanggal vs Per Tanggal (1 Hari) */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setDateMode("range")}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  dateMode === "range"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Rentang Tanggal
              </button>
              <button
                type="button"
                onClick={() => setDateMode("single")}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  dateMode === "single"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Per Tanggal (Per Day)
              </button>
            </div>

            {dateMode === "range" ? (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                <span className="text-slate-500">Dari:</span>
                <input
                  type="date"
                  value={globalSince}
                  onChange={(e) => setGlobalSince(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={globalUntil}
                  onChange={(e) => setGlobalUntil(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                  <span className="text-slate-500">Pilih Tanggal:</span>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="bg-transparent font-medium text-slate-800 focus:outline-none"
                  />
                </div>
                {availableDates.length > 0 && (
                  <select
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value="">— Pilih dari tanggal tersedia ({availableDates.length} hari) —</option>
                    {availableDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="size-3.5" />
            Reset Semua Filter
          </button>
        </div>
      </div>

      {/* =====================================================================
          1. CAMPAIGN PERFORMANCE (Unified columns with Creative Performance)
         ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Campaign performance</h2>
            <p className="text-xs text-slate-500">
              Klik judul kolom untuk mengurutkan (sort), atau gunakan filter di bawah untuk menyaring per Campaign, Ad Set, & Tanggal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Gabungan vs Per Tanggal */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setCampGroupByDay(false)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  !campGroupByDay ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                Ringkasan Campaign
              </button>
              <button
                type="button"
                onClick={() => setCampGroupByDay(true)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  campGroupByDay ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                Tampilkan Per Hari (Per Day)
              </button>
            </div>
          </div>
        </div>

        {/* Campaign Table Header Filter Bar */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Search className="size-3.5 text-slate-400" />
            <input
              type="text"
              value={campSearch}
              onChange={(e) => setCampSearch(e.target.value)}
              placeholder="Cari Campaign / Ad Set..."
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Filter className="size-3.5 text-slate-400" />
            <select
              value={campFilterCampaign}
              onChange={(e) => setCampFilterCampaign(e.target.value)}
              className="w-full bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Campaign ({availableCampaigns.length})</option>
              {availableCampaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Filter className="size-3.5 text-slate-400" />
            <select
              value={campFilterAdset}
              onChange={(e) => setCampFilterAdset(e.target.value)}
              className="w-full bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Ad Set ({availableAdsets.length})</option>
              {availableAdsets.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Calendar className="size-3.5 text-slate-400" />
            <input
              type="date"
              value={campSince}
              onChange={(e) => setCampSince(e.target.value)}
              className="w-full bg-transparent text-slate-700 focus:outline-none"
              title="Dari tanggal (khusus tabel Campaign)"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={campUntil}
              onChange={(e) => setCampUntil(e.target.value)}
              className="w-full bg-transparent text-slate-700 focus:outline-none"
              title="Sampai tanggal (khusus tabel Campaign)"
            />
          </div>
        </div>

        {/* Campaign Performance Table (Matched columns with Creative Performance!) */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {campGroupByDay && (
                  <SortHeader
                    label="Tanggal"
                    sortKey="date"
                    sort={campSort}
                    onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                    align="left"
                  />
                )}
                <SortHeader
                  label="Campaign Name"
                  sortKey="name"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                  align="left"
                />
                <SortHeader
                  label="Ad Set Name"
                  sortKey="subname"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                  align="left"
                />
                <SortHeader
                  label="Amount Spend"
                  sortKey="spend"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="Impressions"
                  sortKey="impressions"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="Clicks"
                  sortKey="clicks"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="CTR"
                  sortKey="ctr"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="CPC"
                  sortKey="cpc"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="CPM"
                  sortKey="cpm"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="Messages"
                  sortKey="messages"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="CPA"
                  sortKey="cpa"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="Hook Rate"
                  sortKey="hookRate"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="View 25%"
                  sortKey="videoP25"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="View 50%"
                  sortKey="videoP50"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="Nilai Deal"
                  sortKey="purchaseValue"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
                <SortHeader
                  label="ROAS"
                  sortKey="roas"
                  sort={campSort}
                  onToggle={(k) => setCampSort(toggleSort(campSort, k))}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaignRows.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={campGroupByDay ? 16 : 15}
                    className="py-8 text-center text-slate-400"
                  >
                    Belum ada data campaign untuk filter ini. Silakan import file CSV/XLSX di menu Input Data Iklan.
                  </td>
                </tr>
              ) : (
                campaignRows.items.map((c, idx) => (
                  <tr
                    key={`${c.date ?? "all"}-${c.campaignName}-${c.adsetName}-${idx}`}
                    className="hover:bg-slate-50/80"
                  >
                    {campGroupByDay && (
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-700">
                        {c.date}
                      </td>
                    )}
                    <td className="px-3 py-3 font-semibold text-slate-900">{c.campaignName}</td>
                    <td className="px-3 py-3 text-slate-600">{c.adsetName}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatIDR(c.spend)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {c.impressions.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {(c.linkClicks || c.clicks).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {c.ctr.toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatIDR(c.cpc)}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatIDR(c.cpm)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {c.messages.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatIDR(c.cpa)}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {c.hookRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {c.videoP25.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {c.videoP50.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                      {formatIDR(c.purchaseValue)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-blue-600">
                      {c.roas.toFixed(2)}x
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {campaignRows.items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-900">
                  <td colSpan={campGroupByDay ? 3 : 2} className="px-3 py-3">
                    Grand Total ({campaignRows.items.length} baris)
                  </td>
                  <td className="px-3 py-3 text-right">{formatIDR(campaignRows.total.spend)}</td>
                  <td className="px-3 py-3 text-right">
                    {campaignRows.total.impressions.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {(
                      campaignRows.total.linkClicks || campaignRows.total.clicks
                    ).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">{campaignRows.total.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3 text-right">{formatIDR(campaignRows.total.cpc)}</td>
                  <td className="px-3 py-3 text-right">{formatIDR(campaignRows.total.cpm)}</td>
                  <td className="px-3 py-3 text-right">
                    {campaignRows.total.messages.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">{formatIDR(campaignRows.total.cpa)}</td>
                  <td className="px-3 py-3 text-right">
                    {campaignRows.total.hookRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right">
                    {campaignRows.total.videoP25.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {campaignRows.total.videoP50.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {formatIDR(campaignRows.total.purchaseValue)}
                  </td>
                  <td className="px-3 py-3 text-right text-blue-600">
                    {campaignRows.total.roas.toFixed(2)}x
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* =====================================================================
          2. CREATIVE PERFORMANCE (Unified columns + Header Filter & Per-Day)
         ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Creative Performance</h2>
            <p className="text-xs text-slate-500">
              Evaluasi performa setiap link konten / video iklan beserta Hook Rate, retensi video 25%/50%, dan ROAS.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCreGroupByDay(false)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                !creGroupByDay ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              Ringkasan Creative
            </button>
            <button
              type="button"
              onClick={() => setCreGroupByDay(true)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                creGroupByDay ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              Tampilkan Per Hari (Per Day)
            </button>
          </div>
        </div>

        {/* Creative Filter Bar */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Search className="size-3.5 text-slate-400" />
            <input
              type="text"
              value={creSearch}
              onChange={(e) => setCreSearch(e.target.value)}
              placeholder="Cari Link Instagram / Nama Creative..."
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Filter className="size-3.5 text-slate-400" />
            <select
              value={creFilterCampaign}
              onChange={(e) => setCreFilterCampaign(e.target.value)}
              className="w-full bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Campaign ({availableCampaigns.length})</option>
              {availableCampaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Calendar className="size-3.5 text-slate-400" />
            <input
              type="date"
              value={creSince}
              onChange={(e) => setCreSince(e.target.value)}
              className="w-full bg-transparent text-slate-700 focus:outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={creUntil}
              onChange={(e) => setCreUntil(e.target.value)}
              className="w-full bg-transparent text-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {creGroupByDay && (
                  <SortHeader
                    label="Tanggal"
                    sortKey="date"
                    sort={creSort}
                    onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                    align="left"
                  />
                )}
                <SortHeader
                  label="Creative Link"
                  sortKey="name"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                  align="left"
                />
                <SortHeader
                  label="Amount Spend"
                  sortKey="spend"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="Impressions"
                  sortKey="impressions"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="Clicks"
                  sortKey="clicks"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="CTR"
                  sortKey="ctr"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="CPC"
                  sortKey="cpc"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="CPM"
                  sortKey="cpm"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="Messages"
                  sortKey="messages"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="CPA"
                  sortKey="cpa"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="Hook Rate"
                  sortKey="hookRate"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="View 25%"
                  sortKey="videoP25"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="View 50%"
                  sortKey="videoP50"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="Nilai Deal"
                  sortKey="purchaseValue"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
                <SortHeader
                  label="ROAS"
                  sortKey="roas"
                  sort={creSort}
                  onToggle={(k) => setCreSort(toggleSort(creSort, k))}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creativeRows.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={creGroupByDay ? 15 : 14}
                    className="py-8 text-center text-slate-400"
                  >
                    Belum ada data creative untuk filter ini.
                  </td>
                </tr>
              ) : (
                creativeRows.items.map((cr, idx) => (
                  <tr
                    key={`${cr.date ?? "all"}-${cr.creativeLink}-${idx}`}
                    className="hover:bg-slate-50/80"
                  >
                    {creGroupByDay && (
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-700">
                        {cr.date}
                      </td>
                    )}
                    <td className="px-3 py-3 font-medium text-brand-600">
                      {cr.creativeLink.startsWith("http") ? (
                        <a
                          href={cr.creativeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <span className="max-w-xs truncate">{cr.creativeLink}</span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-800">{cr.creativeLink}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatIDR(cr.spend)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {cr.impressions.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {(cr.linkClicks || cr.clicks).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {cr.ctr.toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatIDR(cr.cpc)}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatIDR(cr.cpm)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {cr.messages.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatIDR(cr.cpa)}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {cr.hookRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {cr.videoP25.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {cr.videoP50.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                      {formatIDR(cr.purchaseValue)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-blue-600">
                      {cr.roas.toFixed(2)}x
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {creativeRows.items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-900">
                  <td colSpan={creGroupByDay ? 2 : 1} className="px-3 py-3">
                    Grand Total ({creativeRows.items.length} baris)
                  </td>
                  <td className="px-3 py-3 text-right">{formatIDR(creativeRows.total.spend)}</td>
                  <td className="px-3 py-3 text-right">
                    {creativeRows.total.impressions.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {(
                      creativeRows.total.linkClicks || creativeRows.total.clicks
                    ).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">{creativeRows.total.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3 text-right">{formatIDR(creativeRows.total.cpc)}</td>
                  <td className="px-3 py-3 text-right">{formatIDR(creativeRows.total.cpm)}</td>
                  <td className="px-3 py-3 text-right">
                    {creativeRows.total.messages.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">{formatIDR(creativeRows.total.cpa)}</td>
                  <td className="px-3 py-3 text-right">
                    {creativeRows.total.hookRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right">
                    {creativeRows.total.videoP25.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {creativeRows.total.videoP50.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {formatIDR(creativeRows.total.purchaseValue)}
                  </td>
                  <td className="px-3 py-3 text-right text-blue-600">
                    {creativeRows.total.roas.toFixed(2)}x
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* =====================================================================
          3. TABEL LENGKAP HARIAN (FORMAT REPORT ADS 2026)
         ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tabel Lengkap Harian (Format Report Ads 2026)
            </h2>
            <p className="text-xs text-slate-500">
              Format kolom identik dengan spreadsheet manual Anda — dilengkapi filter Tanggal, Campaign, Ad Set, dan pengurutan di setiap kolom.
            </p>
          </div>
        </div>

        {/* Daily Table Filter Bar */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Search className="size-3.5 text-slate-400" />
            <input
              type="text"
              value={dailySearch}
              onChange={(e) => setDailySearch(e.target.value)}
              placeholder="Cari Tanggal / Campaign / Creative..."
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Filter className="size-3.5 text-slate-400" />
            <select
              value={dailyFilterCampaign}
              onChange={(e) => setDailyFilterCampaign(e.target.value)}
              className="w-full bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Campaign ({availableCampaigns.length})</option>
              {availableCampaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Filter className="size-3.5 text-slate-400" />
            <select
              value={dailyFilterAdset}
              onChange={(e) => setDailyFilterAdset(e.target.value)}
              className="w-full bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Ad Set ({availableAdsets.length})</option>
              {availableAdsets.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Calendar className="size-3.5 text-slate-400" />
            <input
              type="date"
              value={dailySince}
              onChange={(e) => setDailySince(e.target.value)}
              className="w-full bg-transparent text-slate-700 focus:outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={dailyUntil}
              onChange={(e) => setDailyUntil(e.target.value)}
              className="w-full bg-transparent text-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#2b547e] text-white">
                <SortHeader
                  label="Tanggal"
                  sortKey="date"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  align="left"
                  lightText
                />
                <SortHeader
                  label="Campaign"
                  sortKey="name"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  align="left"
                  lightText
                />
                <SortHeader
                  label="Adset"
                  sortKey="subname"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  align="left"
                  lightText
                />
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase">Creative</th>
                <SortHeader
                  label="Amount Spend"
                  sortKey="spend"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="Impression"
                  sortKey="impressions"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="Click"
                  sortKey="clicks"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="CTR"
                  sortKey="ctr"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="CPC"
                  sortKey="cpc"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="CPM"
                  sortKey="cpm"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="MESSAGE"
                  sortKey="messages"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="CPA"
                  sortKey="cpa"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="Hook Rate"
                  sortKey="hookRate"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="Iklan Ditonton 25%"
                  sortKey="videoP25"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="Iklan Ditonton 50%"
                  sortKey="videoP50"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="Nilai Deal"
                  sortKey="purchaseValue"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
                <SortHeader
                  label="ROAS"
                  sortKey="roas"
                  sort={dailySort}
                  onToggle={(k) => setDailySort(toggleSort(dailySort, k))}
                  lightText
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dailyRows.items.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-8 text-center text-slate-400">
                    Data kosong. Silakan unggah file CSV/Excel Anda di menu Input Data Iklan.
                  </td>
                </tr>
              ) : (
                dailyRows.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">
                      {r.date}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.campaignName}</td>
                    <td className="px-3 py-2 text-slate-700">{r.adsetName}</td>
                    <td className="max-w-[240px] px-3 py-2 text-brand-600">
                      <div className="truncate font-medium">
                        {r.creativeLink.startsWith("http") ? (
                          <a
                            href={r.creativeLink}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {r.creativeLink}
                          </a>
                        ) : (
                          <span className="text-slate-800">{r.creativeLink}</span>
                        )}
                      </div>
                      {r.publisherPlatform && (
                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {r.publisherPlatform}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {r.spend.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {r.impressions.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {(r.linkClicks || r.clicks).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.ctr.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatIDR(r.cpc)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatIDR(r.cpm)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {r.messages}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {Math.round(r.cpa).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {r.hookRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.videoP25}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.videoP50}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {r.purchaseValue.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-blue-600">
                      {r.roas.toFixed(2)}x
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {dailyRows.items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                  <td colSpan={4} className="px-3 py-2.5">
                    Grand Total ({dailyRows.items.length} baris harian)
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {dailyRows.total.spend.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {dailyRows.total.impressions.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(dailyRows.total.linkClicks || dailyRows.total.clicks).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right">{dailyRows.total.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-right">{formatIDR(dailyRows.total.cpc)}</td>
                  <td className="px-3 py-2.5 text-right">{formatIDR(dailyRows.total.cpm)}</td>
                  <td className="px-3 py-2.5 text-right">{dailyRows.total.messages}</td>
                  <td className="px-3 py-2.5 text-right">
                    {Math.round(dailyRows.total.cpa).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {dailyRows.total.hookRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right">{dailyRows.total.videoP25}</td>
                  <td className="px-3 py-2.5 text-right">{dailyRows.total.videoP50}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">
                    {dailyRows.total.purchaseValue.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-600">
                    {dailyRows.total.roas.toFixed(2)}x
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}


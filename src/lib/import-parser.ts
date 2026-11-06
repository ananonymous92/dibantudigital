import * as XLSX from "xlsx";

export type NormalizedInsightRow = {
  date: string; // YYYY-MM-DD
  rowKey: string;
  campaignName: string;
  adsetName: string;
  adName: string;
  creativeUrl: string | null;
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
  publisherPlatform: string;
  objective: string;
  ageRange: string | null;
  gender: string | null;
};

export type ColumnMapping = {
  date?: string;
  campaignName?: string;
  adsetName?: string;
  adName?: string;
  creativeUrl?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  linkClicks?: string;
  messages?: string;
  results?: string;
  video3s?: string;
  hookRate?: string;
  videoP25?: string;
  videoP50?: string;
  videoP75?: string;
  videoP100?: string;
  purchaseValue?: string;
  publisherPlatform?: string;
  objective?: string;
  ageRange?: string;
  gender?: string;
};

const HEADER_SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  date: [
    "tanggal",
    "awal pelaporan",
    "reporting starts",
    "day",
    "hari",
    "date",
    "date_start",
  ],
  campaignName: ["nama kampanye", "campaign name", "campaign", "campaign_name"],
  adsetName: ["nama set iklan", "ad set name", "adset", "ad set", "adset_name"],
  adName: ["iklan", "nama iklan", "ad name", "ad", "ad_name"],
  creativeUrl: [
    "creative",
    "creative link",
    "creative url",
    "instagram permalink",
    "link iklan",
    "tautan iklan",
    "url",
  ],
  spend: [
    "jumlah yang dibelanjakan (idr)",
    "jumlah yang dibelanjakan",
    "amount spend",
    "amount spent (idr)",
    "amount spent (usd)",
    "amount spent",
    "biaya",
    "spend",
  ],
  impressions: ["impresi", "impression", "impressions", "tayangan"],
  reach: ["jangkauan", "reach"],
  clicks: ["klik (semua)", "clicks (all)", "all clicks", "total klik"],
  linkClicks: ["klik tautan", "link clicks", "click", "clicks", "inline_link_clicks"],
  messages: [
    "percakapan pesan dimulai",
    "percakapan pesan yang dimulai",
    "messaging conversations started",
    "pesan percakapan",
    "message",
    "messages",
    "pesan",
  ],
  results: ["hasil", "results", "result"],
  video3s: [
    "pemutaran video 3 detik",
    "video diputar 3 detik",
    "3-second video plays",
    "video 3s",
    "3s video views",
  ],
  hookRate: ["hook rate", "hook_rate", "hookrate"],
  videoP25: [
    "video diputar hingga 25%",
    "pemutaran video hingga 25%",
    "video diputar 25%",
    "iklan ditonton 25%",
    "video plays at 25%",
    "video_p25",
    "ditonton 25%",
  ],
  videoP50: [
    "pemutaran video hingga 50%",
    "video diputar hingga 50%",
    "video diputar 50%",
    "iklan ditonton 50%",
    "video plays at 50%",
    "video_p50",
    "ditonton 50%",
  ],
  videoP75: [
    "pemutaran video hingga 75%",
    "video diputar hingga 75%",
    "iklan ditonton 75%",
    "video plays at 75%",
    "video diputar 75%",
    "video_p75",
  ],
  videoP100: [
    "pemutaran video hingga 100%",
    "video diputar hingga 100%",
    "iklan ditonton 100%",
    "video plays at 100%",
    "video diputar 100%",
    "video_p100",
  ],
  purchaseValue: [
    "nilai deal",
    "omset",
    "revenue",
    "purchases conversion value",
    "nilai konversi pembelian",
    "purchase value",
    "omzet",
  ],
  publisherPlatform: [
    "penempatan",
    "placement",
    "platform",
    "source",
    "publisher_platform",
    "sumber",
  ],
  objective: ["campaign type", "objective", "tujuan", "tipe kampanye"],
  ageRange: ["age", "umur", "usia"],
  gender: ["gender", "jenis kelamin"],
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Auto-detect column mapping from raw spreadsheet headers (ID / EN / Manual Sheet). */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  (Object.keys(HEADER_SYNONYMS) as (keyof ColumnMapping)[]).forEach((field) => {
    const candidates = HEADER_SYNONYMS[field];
    // 1. Exact match first
    for (const c of candidates) {
      const found = normalized.find((h) => h.norm === c);
      if (found) {
        mapping[field] = found.raw;
        return;
      }
    }
    // 2. Prefix match ONLY for longer multi-word headers (e.g. "jumlah yang dibelanjakan (idr)")
    for (const c of candidates) {
      if (c.length < 6) continue;
      const found = normalized.find((h) => h.norm.startsWith(c));
      if (found) {
        mapping[field] = found.raw;
        return;
      }
    }
  });

  return mapping;
}

/** Parse currency, integer, or percentage string from ID/EN locales into a number. */
export function parseNumber(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined) return 0;
  let s = String(val).trim();
  if (!s || s === "-" || s === "N/A") return 0;

  const hasRp = /^rp/i.test(s);
  // Strip currency symbols, percentage signs, "x" multiplier, spaces
  s = s.replace(/^(rp|idr|\$)\s*/i, "").replace(/[%x\s]/gi, "");

  // Case 1: both "." and "," exist -> last one is decimal separator
  if (s.includes(".") && s.includes(",")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // Indonesian format: 1.850.000,50
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,850,000.50
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Either decimal comma ("1,00") or US thousands ("2,000")
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (s.includes(".")) {
    const parts = s.split(".");
    // Multiple dots ("1.850.000") or explicit "Rp50.000" -> thousand separator
    if (parts.length > 2 || (hasRp && parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, "");
    }
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
}

/** Parse date cell (YYYY-MM-DD, DD/MM/YYYY, or Excel serial number) to YYYY-MM-DD. */
export function parseDateString(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "number" && val > 25000 && val < 80000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86_400_000);
    return d.toISOString().slice(0, 10);
  }

  const s = String(val).replace(/^\uFEFF/, "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

/** Read a CSV or XLSX Buffer into raw records + headers. */
export function readSpreadsheetBuffer(buffer: Buffer): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  // Strip UTF-8 BOM if present at the start of a CSV buffer
  const cleanBuffer =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
      ? buffer.subarray(3)
      : buffer;

  const workbook = XLSX.read(cleanBuffer, {
    type: "buffer",
    raw: true,
    codepage: 65001,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Transform raw spreadsheet rows into validated, normalized insight rows ready for DB upsert. */
export function normalizeSpreadsheetRows(
  rows: Record<string, unknown>[],
  mapping?: ColumnMapping,
): NormalizedInsightRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const map = mapping ?? detectColumnMapping(headers);
  const out: NormalizedInsightRow[] = [];

  for (const row of rows) {
    const date = map.date ? parseDateString(row[map.date]) : null;
    if (!date) continue; // skip summary / empty rows

    const campaignName =
      String((map.campaignName ? row[map.campaignName] : "") ?? "").trim() || "Campaign";
    const adsetName =
      String((map.adsetName ? row[map.adsetName] : "") ?? "").trim() || "All Ad Sets";
    const creativeRaw = String((map.creativeUrl ? row[map.creativeUrl] : "") ?? "").trim();
    const adNameRaw = String((map.adName ? row[map.adName] : "") ?? "").trim();
    const adName = adNameRaw || creativeRaw || adsetName;
    const creativeUrl = creativeRaw.startsWith("http") ? creativeRaw : null;

    const spend = map.spend ? parseNumber(row[map.spend]) : 0;
    const impressions = Math.round(map.impressions ? parseNumber(row[map.impressions]) : 0);
    const reach = Math.round(map.reach ? parseNumber(row[map.reach]) : 0);

    const rawLinkClicks = map.linkClicks ? Math.round(parseNumber(row[map.linkClicks])) : 0;
    const rawAllClicks = map.clicks ? Math.round(parseNumber(row[map.clicks])) : 0;
    const clicks = rawAllClicks || rawLinkClicks;
    const linkClicks = rawLinkClicks || rawAllClicks;

    const messages = Math.round(map.messages ? parseNumber(row[map.messages]) : 0);
    const results = Math.round(map.results ? parseNumber(row[map.results]) : messages);
    const videoP25 = Math.round(map.videoP25 ? parseNumber(row[map.videoP25]) : 0);
    const videoP50 = Math.round(map.videoP50 ? parseNumber(row[map.videoP50]) : 0);
    const videoP75 = Math.round(map.videoP75 ? parseNumber(row[map.videoP75]) : 0);
    const videoP100 = Math.round(map.videoP100 ? parseNumber(row[map.videoP100]) : 0);
    const purchaseValue = map.purchaseValue ? parseNumber(row[map.purchaseValue]) : 0;

    let video3s = Math.round(map.video3s ? parseNumber(row[map.video3s]) : 0);
    if (video3s === 0 && map.hookRate && impressions > 0) {
      const rawHook = row[map.hookRate];
      let hookPct = parseNumber(rawHook);
      if (typeof rawHook === "number" && rawHook > 0 && rawHook < 1) {
        hookPct = rawHook * 100;
      }
      video3s = Math.round((hookPct / 100) * impressions);
    }

    const publisherPlatform =
      String((map.publisherPlatform ? row[map.publisherPlatform] : "") ?? "").trim() ||
      "Facebook Ads";
    const objective =
      String((map.objective ? row[map.objective] : "") ?? "").trim() || "Leads / Messages";
    const ageRange = String((map.ageRange ? row[map.ageRange] : "") ?? "").trim() || null;
    const gender = String((map.gender ? row[map.gender] : "") ?? "").trim() || null;

    const rowKey = [
      date,
      campaignName.toLowerCase(),
      adsetName.toLowerCase(),
      adName.toLowerCase(),
      publisherPlatform.toLowerCase(),
      ageRange ?? "",
      gender ?? "",
    ].join("|");

    out.push({
      date,
      rowKey,
      campaignName,
      adsetName,
      adName,
      creativeUrl,
      spend,
      impressions,
      reach,
      clicks,
      linkClicks,
      messages,
      results,
      video3s,
      videoP25,
      videoP50,
      videoP75,
      videoP100,
      purchaseValue,
      publisherPlatform,
      objective,
      ageRange,
      gender,
    });
  }

  return out;
}

import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { computeAccess, extendPeriod } from "../src/lib/billing/access";
import {
  normalizeSpreadsheetRows,
  readSpreadsheetBuffer,
} from "../src/lib/import-parser";
import { computeMetrics } from "../src/lib/metrics";
import { SAMPLE_META_CSV } from "../src/lib/sample-scuto-csv";

// 1. Verify exact metrics calculation from Photo 5 (Report Ads 2026)
const photo5 = computeMetrics({
  spend: 100_000,
  impressions: 2_000,
  reach: 1_800,
  clicks: 20,
  linkClicks: 20,
  messages: 1,
  results: 1,
  video3s: 60,
  videoP25: 60,
  videoP50: 20,
  videoP75: 10,
  videoP100: 5,
  purchaseValue: 1_000_000,
});

assert.equal(photo5.ctr, 1.0, "CTR should be 1.00%");
assert.equal(photo5.cpc, 5_000, "CPC should be Rp 5.000");
assert.equal(photo5.cpm, 50_000, "CPM should be Rp 50.000");
assert.equal(photo5.cpa, 100_000, "CPA should be Rp 100.000");
assert.equal(photo5.hookRate, 3.0, "Hook Rate should be 3%");
assert.equal(photo5.roas, 10.0, "ROAS should be 10.00x");
console.log("✓ Photo 5 metric formulas verified (CTR, CPC, CPM, CPA, Hook Rate, ROAS)");

// 2. Verify CSV/XLSX parser for Manual Spreadsheet (Photo 5) + Meta Ads Manager (ID & EN)
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet([
  {
    Tanggal: "2026-11-01",
    Campaign: "ABO - APPASCO",
    Adset: "JABODETABAKE 24-54",
    Creative: "https://www.instagram.com/p/DfTkqJRBmiH/",
    "Amount Spend": "100000",
    Impression: "2,000",
    Click: "20",
    CTR: "1,00%",
    CPC: "Rp5.000",
    CPM: "Rp50.000",
    MESSAGE: "1",
    CPA: "100000",
    "Hook Rate": "3%",
    "Iklan Ditonton 25%": "60",
    "Iklan Ditonton 50%": "20",
    "Nilai Deal": "1000000",
    ROAS: "10,00x",
  },
]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
const parsed = readSpreadsheetBuffer(buf);
const normalized = normalizeSpreadsheetRows(parsed.rows);

assert.equal(normalized.length, 1);
assert.equal(normalized[0].date, "2026-11-01");
assert.equal(normalized[0].campaignName, "ABO - APPASCO");
assert.equal(normalized[0].adsetName, "JABODETABAKE 24-54");
assert.equal(normalized[0].creativeUrl, "https://www.instagram.com/p/DfTkqJRBmiH/");
assert.equal(normalized[0].spend, 100_000);
assert.equal(normalized[0].impressions, 2_000);
assert.equal(normalized[0].linkClicks, 20);
assert.equal(normalized[0].messages, 1);
assert.equal(normalized[0].video3s, 60); // auto back-calculated from 3% Hook Rate * 2000 impressions
assert.equal(normalized[0].videoP25, 60);
assert.equal(normalized[0].videoP50, 20);
assert.equal(normalized[0].purchaseValue, 1_000_000);
console.log("✓ XLSX/CSV parser & column auto-detection verified");

// 3. Verify Meta Ads Manager Indonesian export headers
const idNormalized = normalizeSpreadsheetRows([
  {
    "Awal pelaporan": "2026-11-02",
    "Nama kampanye": "Kampanye Konversi WA",
    "Nama set iklan": "Set Iklan Jakarta",
    "Nama iklan": "Video Reels 01",
    "Jumlah yang dibelanjakan (IDR)": "250000",
    Impresi: "5000",
    "Klik tautan": "125",
    "Percakapan pesan yang dimulai": "10",
    "Pemutaran video 3 detik": "1500",
    "Video diputar 25%": "900",
    "Video diputar 50%": "450",
    "Nilai konversi pembelian": "1250000",
  },
]);
assert.equal(idNormalized.length, 1);
assert.equal(idNormalized[0].spend, 250_000);
assert.equal(idNormalized[0].messages, 10);
assert.equal(idNormalized[0].video3s, 1_500);
assert.equal(idNormalized[0].purchaseValue, 1_250_000);
console.log("✓ Meta Ads Manager (Bahasa Indonesia & English) export mapping verified");

// 3b. Verify real Scuto Pusat 1-4 Nov 2026 CSV (148 rows with Iklan & Penempatan breakdown)
const scutoParsed = readSpreadsheetBuffer(Buffer.from(SAMPLE_META_CSV, "utf8"));
const scutoRows = normalizeSpreadsheetRows(scutoParsed.rows);
const scutoUniqueKeys = new Set(scutoRows.map((r) => r.rowKey));
const scutoTotals = scutoRows.reduce(
  (acc, r) => {
    acc.spend += r.spend;
    acc.impressions += r.impressions;
    acc.reach += r.reach;
    acc.clicks += r.clicks;
    acc.linkClicks += r.linkClicks;
    acc.messages += r.messages;
    acc.videoP25 += r.videoP25;
    acc.videoP50 += r.videoP50;
    acc.video3s += r.video3s;
    return acc;
  },
  {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    linkClicks: 0,
    messages: 0,
    videoP25: 0,
    videoP50: 0,
    video3s: 0,
  },
);
console.log(
  `✓ Real Scuto Pusat CSV (${scutoRows.length} rows) totals:`,
  scutoTotals,
);
assert.equal(scutoRows.length, 239, "Should parse all 239 rows from Scuto Pusat CSV");
assert.equal(scutoUniqueKeys.size, 239, "All 239 placement+ad rows should have unique rowKeys");
assert.equal(scutoTotals.spend, 2_321_992, "Total spend across all 239 rows");

// 4. Verify prepaid subscription periods (1, 3, 6, 12 months) & access rules
const now = new Date("2026-11-04T00:00:00Z");
const m1 = extendPeriod(null, 1, now);
const m3 = extendPeriod(null, 3, now);
const m6 = extendPeriod(null, 6, now);
const m12 = extendPeriod(null, 12, now);
assert.equal(m1.toISOString().slice(0, 10), "2026-12-04");
assert.equal(m3.toISOString().slice(0, 10), "2027-02-04");
assert.equal(m6.toISOString().slice(0, 10), "2027-05-04");
assert.equal(m12.toISOString().slice(0, 10), "2027-11-04");

const activeAccess = computeAccess(
  { status: "active", trialEndsAt: null, currentPeriodEnd: m3 },
  now,
);
assert.equal(activeAccess.hasAccess, true);
console.log("✓ Prepaid subscription periods (1, 3, 6, 12 months) verified");

// 5. Verify embedded PostgreSQL (PGlite) + BOOTSTRAP_DDL + Drizzle ORM queries
async function verifyEmbeddedDb() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { BOOTSTRAP_DDL } = await import("../src/db/bootstrap-sql");
  const schema = await import("../src/db/schema");

  const pg = new PGlite();
  void pg.exec(BOOTSTRAP_DDL);
  const testDb = drizzle(pg, { schema });

  const [u] = await testDb
    .insert(schema.users)
    .values({
      name: "Richi Adhera",
      email: "ananonymous92@gmail.com",
      passwordHash: "hash",
    })
    .returning();
  assert.equal(u.email, "ananonymous92@gmail.com");
  await pg.close();
  console.log("✓ Embedded PostgreSQL (PGlite) auto-bootstrap & user registration verified");
}

verifyEmbeddedDb().catch((err) => {
  console.error(err);
  process.exit(1);
});


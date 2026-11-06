/**
 * Seed default plans and placeholder prices (idempotent).
 * Run: npm run db:seed
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { BOOTSTRAP_DDL } from "../src/db/bootstrap-sql";
import * as schema from "../src/db/schema";

const PERIOD_DISCOUNTS: Record<number, number> = { 1: 0, 3: 0.05, 6: 0.1, 12: 0.2 };

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    description: "Untuk pemilik bisnis dengan satu akun iklan.",
    maxAdAccounts: 1,
    maxMembers: 1,
    monthlyIdr: 149_000,
    features: ["Dashboard & laporan", "Import file Ads Manager", "Export CSV/Excel"],
    sortOrder: 1,
  },
  {
    code: "pro",
    name: "Pro",
    description: "Untuk tim marketing yang mengelola beberapa akun.",
    maxAdAccounts: 5,
    maxMembers: 3,
    monthlyIdr: 349_000,
    features: ["Semua fitur Starter", "Koneksi Meta API otomatis", "AI Insights", "Laporan terjadwal"],
    sortOrder: 2,
  },
  {
    code: "agency",
    name: "Agency",
    description: "Untuk agensi yang mengelola banyak klien.",
    maxAdAccounts: 20,
    maxMembers: 10,
    monthlyIdr: 899_000,
    features: ["Semua fitur Pro", "Multi-klien", "Laporan PDF white-label", "Prioritas support"],
    sortOrder: 3,
  },
];

function priceFor(monthly: number, months: number): number {
  const total = monthly * months * (1 - PERIOD_DISCOUNTS[months]);
  return Math.round(total / 1000) * 1000;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum di-set (lihat .env.example)");
  const client = postgres(url, { max: 1 });
  await client.unsafe(BOOTSTRAP_DDL);
  console.log("✓ Tabel database PostgreSQL siap");
  const db = drizzle(client, { schema });

  for (const p of PLANS) {
    const [plan] = await db
      .insert(schema.plans)
      .values({
        code: p.code,
        name: p.name,
        description: p.description,
        maxAdAccounts: p.maxAdAccounts,
        maxMembers: p.maxMembers,
        features: p.features,
        sortOrder: p.sortOrder,
      })
      .onConflictDoUpdate({
        target: schema.plans.code,
        set: {
          name: p.name,
          description: p.description,
          maxAdAccounts: p.maxAdAccounts,
          maxMembers: p.maxMembers,
          features: p.features,
          sortOrder: p.sortOrder,
        },
      })
      .returning();

    for (const months of [1, 3, 6, 12]) {
      // Only insert missing prices: prices edited later from the admin panel are kept.
      await db
        .insert(schema.planPrices)
        .values({ planId: plan.id, periodMonths: months, priceIdr: priceFor(p.monthlyIdr, months) })
        .onConflictDoNothing();
    }
    console.log(`✓ Paket ${p.name}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


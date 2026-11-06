import "server-only";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { slugify } from "@/lib/utils";

/** Plan given to new workspaces during the free trial (full features so users can evaluate). */
export const TRIAL_PLAN_CODE = "pro";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

const DEFAULT_PLANS = [
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

const PERIOD_DISCOUNTS: Record<number, number> = { 1: 0, 3: 0.05, 6: 0.1, 12: 0.2 };

async function ensureDefaultPlans(tx: Tx) {
  for (const p of DEFAULT_PLANS) {
    const [plan] = await tx
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
        set: { name: p.name },
      })
      .returning({ id: schema.plans.id });

    for (const months of [1, 3, 6, 12]) {
      const priceIdr =
        Math.round((p.monthlyIdr * months * (1 - PERIOD_DISCOUNTS[months])) / 1000) * 1000;
      await tx
        .insert(schema.planPrices)
        .values({ planId: plan.id, periodMonths: months, priceIdr })
        .onConflictDoNothing();
    }
  }
}

/**
 * Create a workspace, make `userId` its owner and start a free trial.
 * Must be called inside a transaction.
 */
export async function createWorkspaceWithTrial(tx: Tx, userId: string, name: string) {
  let trialPlan = await tx
    .select({ id: schema.plans.id })
    .from(schema.plans)
    .where(eq(schema.plans.code, TRIAL_PLAN_CODE))
    .limit(1);

  if (!trialPlan[0]) {
    await ensureDefaultPlans(tx);
    trialPlan = await tx
      .select({ id: schema.plans.id })
      .from(schema.plans)
      .where(eq(schema.plans.code, TRIAL_PLAN_CODE))
      .limit(1);
  }

  const slug = `${slugify(name) || "workspace"}-${randomBytes(3).toString("hex")}`;
  const [workspace] = await tx
    .insert(schema.workspaces)
    .values({ name: name.trim(), slug })
    .returning();

  await tx.insert(schema.workspaceMembers).values({ workspaceId: workspace.id, userId, role: "owner" });

  const trialEndsAt = new Date(Date.now() + env().TRIAL_DAYS * 86_400_000);
  await tx.insert(schema.subscriptions).values({
    workspaceId: workspace.id,
    planId: trialPlan[0].id,
    status: "trialing",
    trialEndsAt,
  });

  return workspace;
}

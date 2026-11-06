"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { extendPeriod } from "@/lib/billing/access";
import { env } from "@/lib/env";
import { requireWorkspace } from "@/lib/tenant";

/**
 * Create a prepaid invoice for a chosen plan & period (1, 3, 6, or 12 months).
 * If `XENDIT_SECRET_KEY` is configured in `.env`, creates a live/sandbox Xendit
 * Invoice via `https://api.xendit.co/v2/invoices`; otherwise creates a local
 * invoice that can be simulated/activated with 1 click in development mode.
 */
export async function createInvoiceAction(formData: FormData) {
  const ctx = await requireWorkspace();
  const planPriceId = String(formData.get("planPriceId") ?? "");
  if (!planPriceId) return;

  const rows = await db()
    .select({
      price: schema.planPrices,
      plan: schema.plans,
    })
    .from(schema.planPrices)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.planPrices.planId))
    .where(eq(schema.planPrices.id, planPriceId))
    .limit(1);

  const item = rows[0];
  if (!item) return;

  const [invoice] = await db()
    .insert(schema.invoices)
    .values({
      workspaceId: ctx.workspace.id,
      planPriceId: item.price.id,
      amountIdr: item.price.priceIdr,
      status: "pending",
    })
    .returning();

  const xenditKey = process.env.XENDIT_SECRET_KEY?.trim();
  if (xenditKey) {
    try {
      const authHeader = Buffer.from(`${xenditKey}:`).toString("base64");
      const res = await fetch("https://api.xendit.co/v2/invoices", {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_id: invoice.id,
          amount: item.price.priceIdr,
          payer_email: ctx.session.user.email,
          description: `Langganan DibantuDigital ${item.plan.name} (${item.price.periodMonths} Bulan) — ${ctx.workspace.name}`,
          currency: "IDR",
          success_redirect_url: `${env().APP_URL}/app/billing?paid=${invoice.id}`,
          failure_redirect_url: `${env().APP_URL}/app/billing?failed=${invoice.id}`,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id?: string; invoice_url?: string };
        await db()
          .update(schema.invoices)
          .set({
            xenditInvoiceId: data.id ?? null,
            xenditInvoiceUrl: data.invoice_url ?? null,
          })
          .where(eq(schema.invoices.id, invoice.id));
      }
    } catch {
      // Fall back to local invoice view if network/Xendit is unreachable
    }
  }

  revalidatePath("/app/billing");
  revalidatePath("/app");
}

/**
 * Mark an invoice as paid and extend the workspace's subscription by
 * `periodMonths` (1, 3, 6, or 12 months). Used both by the Xendit webhook and
 * the sandbox simulator button in development.
 */
export async function markInvoicePaidById(invoiceId: string) {
  const rows = await db()
    .select({
      invoice: schema.invoices,
      price: schema.planPrices,
    })
    .from(schema.invoices)
    .innerJoin(schema.planPrices, eq(schema.planPrices.id, schema.invoices.planPriceId))
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  const row = rows[0];
  if (!row || row.invoice.status === "paid") return;

  const existingSub = await db()
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.workspaceId, row.invoice.workspaceId))
    .limit(1);

  const now = new Date();
  const currentEnd = existingSub[0]?.currentPeriodEnd ?? existingSub[0]?.trialEndsAt ?? null;
  const nextEnd = extendPeriod(currentEnd, row.price.periodMonths, now);

  await db().transaction(async (tx) => {
    await tx
      .update(schema.invoices)
      .set({ status: "paid", paidAt: now, updatedAt: now })
      .where(eq(schema.invoices.id, invoiceId));

    await tx
      .insert(schema.subscriptions)
      .values({
        workspaceId: row.invoice.workspaceId,
        planId: row.price.planId,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: nextEnd,
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.workspaceId,
        set: {
          planId: row.price.planId,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: nextEnd,
          updatedAt: now,
        },
      });
  });
}

/** Sandbox action so the user can test paying an invoice in local development. */
export async function simulatePayInvoiceAction(formData: FormData) {
  const ctx = await requireWorkspace();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return;

  const owned = await db()
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, invoiceId),
        eq(schema.invoices.workspaceId, ctx.workspace.id),
      ),
    )
    .limit(1);

  if (!owned[0]) return;
  await markInvoicePaidById(invoiceId);
  revalidatePath("/app/billing");
  revalidatePath("/app");
}


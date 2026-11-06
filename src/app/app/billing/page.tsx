import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { createInvoiceAction, simulatePayInvoiceAction } from "@/app/actions/billing";
import { Badge } from "@/components/ui";
import { db, schema } from "@/db";
import { requireWorkspace } from "@/lib/tenant";
import { daysUntil, formatDate, formatIDR } from "@/lib/utils";

export const metadata: Metadata = { title: "Langganan & Billing" };

const PERIOD_LABELS: Record<number, { label: string; badge?: string }> = {
  1: { label: "1 Bulan" },
  3: { label: "3 Bulan", badge: "Hemat 5%" },
  6: { label: "6 Bulan", badge: "Hemat 10%" },
  12: { label: "1 Tahun (12 Bulan)", badge: "Hemat 20%" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const selectedPeriod = [1, 3, 6, 12].includes(Number(params.period))
    ? Number(params.period)
    : 3;

  const ctx = await requireWorkspace();

  const allPlans = await db()
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.isActive, true))
    .orderBy(asc(schema.plans.sortOrder));

  const allPrices = await db()
    .select()
    .from(schema.planPrices)
    .where(eq(schema.planPrices.isActive, true));

  const invoiceHistory = await db()
    .select({
      invoice: schema.invoices,
      planName: schema.plans.name,
      periodMonths: schema.planPrices.periodMonths,
    })
    .from(schema.invoices)
    .innerJoin(schema.planPrices, eq(schema.planPrices.id, schema.invoices.planPriceId))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.planPrices.planId))
    .where(eq(schema.invoices.workspaceId, ctx.workspace.id))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(10);

  const remainingDays = ctx.access.endsAt ? daysUntil(ctx.access.endsAt) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Langganan & Billing (Xendit)</h1>
          <p className="text-xs text-slate-500">
            Pilih durasi langganan 1 bulan, 3 bulan, 6 bulan, atau 1 tahun (QRIS, Virtual Account, E-Wallet, Kartu).
          </p>
        </div>
      </div>

      {/* Current subscription card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Sparkles className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Paket Saat Ini: {ctx.subscription?.planName ?? "Pro"}
              </h2>
              <Badge tone={ctx.access.hasAccess ? "success" : "danger"}>
                {ctx.access.kind === "trial"
                  ? "Free Trial"
                  : ctx.access.hasAccess
                    ? "Aktif"
                    : "Berakhir"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {ctx.access.endsAt
                ? `Berlaku hingga ${formatDate(ctx.access.endsAt)} (${remainingDays} hari tersisa)`
                : "Belum ada periode aktif"}
            </p>
          </div>
        </div>
      </div>

      {/* Duration selector tabs: 1, 3, 6, 12 months */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-slate-900">Pilih Periode Berlangganan</h2>
        <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs">
          {[1, 3, 6, 12].map((m) => {
            const info = PERIOD_LABELS[m];
            const active = selectedPeriod === m;
            return (
              <a
                key={m}
                href={`/app/billing?period=${m}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{info.label}</span>
                {info.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {info.badge}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {allPlans.map((plan) => {
          const priceRow = allPrices.find(
            (p) => p.planId === plan.id && p.periodMonths === selectedPeriod,
          );
          const totalIdr = priceRow?.priceIdr ?? 0;
          const monthlyEq = Math.round(totalIdr / selectedPeriod);
          const isPopular = plan.code === "pro";

          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-xs ${
                isPopular ? "border-brand-600 ring-2 ring-brand-500/20" : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  {isPopular && <Badge tone="brand">Paling Populer</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{plan.description}</p>

                <div className="mt-5">
                  <p className="text-2xl font-extrabold text-slate-900">
                    {formatIDR(monthlyEq)}
                    <span className="text-xs font-normal text-slate-500"> / bulan</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dibayar per {PERIOD_LABELS[selectedPeriod].label}:{" "}
                    <strong className="text-slate-800">{formatIDR(totalIdr)}</strong>
                  </p>
                </div>

                <ul className="mt-5 space-y-2 text-xs text-slate-700">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" />
                    Hingga <strong>{plan.maxAdAccounts} Ad Account</strong> Meta
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" />
                    Hingga <strong>{plan.maxMembers} Anggota Tim</strong>
                  </li>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {priceRow && (
                <form action={createInvoiceAction} className="mt-6">
                  <input type="hidden" name="planPriceId" value={priceRow.id} />
                  <button
                    type="submit"
                    className={`w-full rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                      isPopular
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    Pilih {plan.name} ({PERIOD_LABELS[selectedPeriod].label})
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {/* Invoice history & sandbox simulator */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Riwayat Invoice & Pembayaran</h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-2.5 pr-3">Tanggal</th>
                <th className="px-3 py-2.5">Paket & Periode</th>
                <th className="px-3 py-2.5 text-right">Total Tagihan</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="py-2.5 pl-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoiceHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Belum ada riwayat invoice. Pilih paket di atas untuk membuat tagihan.
                  </td>
                </tr>
              ) : (
                invoiceHistory.map(({ invoice, planName, periodMonths }) => (
                  <tr key={invoice.id}>
                    <td className="py-3 pr-3 text-slate-600">{formatDate(invoice.createdAt)}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {planName} — {periodMonths} Bulan
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatIDR(invoice.amountIdr)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={invoice.status === "paid" ? "success" : "warning"}>
                        {invoice.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {invoice.status === "pending" && (
                        <div className="inline-flex items-center gap-2">
                          {invoice.xenditInvoiceUrl && (
                            <a
                              href={invoice.xenditInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-brand-700"
                            >
                              Bayar via Xendit
                            </a>
                          )}
                          <form action={simulatePayInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              Simulasi Lunas (Sandbox)
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


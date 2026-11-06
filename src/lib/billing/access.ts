/**
 * Pure subscription-access rules (no I/O) so they are easy to unit test.
 *
 * - trialing: access until trialEndsAt
 * - active / past_due: access until currentPeriodEnd + grace period
 * - expired / canceled: no access
 */
export const GRACE_DAYS = 3;
const DAY_MS = 86_400_000;

export type SubscriptionLike = {
  status: "trialing" | "active" | "past_due" | "expired" | "canceled";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export type AccessState =
  | { hasAccess: true; kind: "trial" | "active" | "grace"; endsAt: Date }
  | { hasAccess: false; kind: "expired" | "none"; endsAt: Date | null };

export function computeAccess(sub: SubscriptionLike | null, now: Date = new Date()): AccessState {
  if (!sub) return { hasAccess: false, kind: "none", endsAt: null };
  const t = now.getTime();

  if (sub.status === "trialing") {
    if (sub.trialEndsAt && sub.trialEndsAt.getTime() > t) {
      return { hasAccess: true, kind: "trial", endsAt: sub.trialEndsAt };
    }
    return { hasAccess: false, kind: "expired", endsAt: sub.trialEndsAt };
  }

  if (sub.status === "active" || sub.status === "past_due") {
    const end = sub.currentPeriodEnd;
    if (end && end.getTime() > t) return { hasAccess: true, kind: "active", endsAt: end };
    if (end && end.getTime() + GRACE_DAYS * DAY_MS > t) {
      return { hasAccess: true, kind: "grace", endsAt: new Date(end.getTime() + GRACE_DAYS * DAY_MS) };
    }
    return { hasAccess: false, kind: "expired", endsAt: end };
  }

  return { hasAccess: false, kind: "expired", endsAt: sub.currentPeriodEnd ?? sub.trialEndsAt };
}

/**
 * New period end when a prepaid period is purchased. Renewing early extends from
 * the current end date so the customer never loses remaining days.
 */
export function extendPeriod(currentEnd: Date | null, months: number, now: Date = new Date()): Date {
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const next = new Date(base.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}


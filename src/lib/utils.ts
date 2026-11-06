import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a free-text name into a URL-friendly slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIDR(value: number): string {
  return idr.format(value);
}

export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(d);
}

/** Whole days remaining from now until `until` (never negative). */
export function daysUntil(until: Date): number {
  return Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86_400_000));
}

/** Check whether a date is already in the past. */
export function isPastDate(date: Date | null | undefined): boolean {
  if (!date) return false;
  return date.getTime() < Date.now();
}

/** Default 30-day date range in YYYY-MM-DD format for Meta API sync forms. */
export function defaultSyncDateRange(): { since: string; until: string } {
  const now = new Date();
  const until = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  return { since, until };
}


import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "expired",
  "canceled",
]);
export const invoiceStatus = pgEnum("invoice_status", ["pending", "paid", "expired", "failed"]);
export const dataSource = pgEnum("data_source", ["meta_api", "import"]);

/* ----------------------------------------------------------------------------
 * Identity & tenancy
 * ------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(), // always stored lowercase
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  ...timestamps,
});

/** Login sessions. `id` is the SHA-256 hash of the cookie token, never the raw token. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeWorkspaceId: uuid("active_workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** A workspace is the tenant boundary: all report data belongs to exactly one workspace. */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  currency: text("currency").notNull().default("IDR"),
  ...timestamps,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("members_user_idx").on(t.userId)],
);

/* ----------------------------------------------------------------------------
 * Billing
 * ------------------------------------------------------------------------- */

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // starter | pro | agency
  name: text("name").notNull(),
  description: text("description"),
  maxAdAccounts: integer("max_ad_accounts").notNull(),
  maxMembers: integer("max_members").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** Price of a plan for a prepaid period (1, 3, 6 or 12 months). Amounts in whole Rupiah. */
export const planPrices = pgTable(
  "plan_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    periodMonths: integer("period_months").notNull(),
    priceIdr: bigint("price_idr", { mode: "number" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("plan_prices_plan_period_uq").on(t.planId, t.periodMonths)],
);

/** Current subscription of a workspace (one row per workspace). */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatus("status").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  ...timestamps,
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planPriceId: uuid("plan_price_id")
      .notNull()
      .references(() => planPrices.id),
    amountIdr: bigint("amount_idr", { mode: "number" }).notNull(),
    status: invoiceStatus("status").notNull().default("pending"),
    xenditInvoiceId: text("xendit_invoice_id").unique(),
    xenditInvoiceUrl: text("xendit_invoice_url"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("invoices_workspace_idx").on(t.workspaceId)],
);

/* ----------------------------------------------------------------------------
 * Report data
 * ------------------------------------------------------------------------- */

/**
 * An ad account inside a workspace. For Meta API accounts `externalId` is the
 * `act_...` id; for imported data it is a user-chosen label.
 */
export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: dataSource("source").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("IDR"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("ad_accounts_ws_external_uq").on(t.workspaceId, t.externalId)],
);

/**
 * Daily performance per ad. Only raw counts are stored; ratios such as CTR,
 * CPC, CPM, CPA, hook rate and ROAS are derived at query time.
 */
export const adInsightsDaily = pgTable(
  "ad_insights_daily",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    adAccountId: uuid("ad_account_id")
      .notNull()
      .references(() => adAccounts.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    /** Deterministic key (date + campaign + ad set + ad) used for idempotent upserts. */
    rowKey: text("row_key").notNull(),
    campaignId: text("campaign_id"),
    campaignName: text("campaign_name").notNull().default(""),
    adsetId: text("adset_id"),
    adsetName: text("adset_name").notNull().default(""),
    adId: text("ad_id"),
    adName: text("ad_name").notNull().default(""),
    creativeUrl: text("creative_url"),
    spend: numeric("spend", { precision: 16, scale: 2, mode: "number" }).notNull().default(0),
    impressions: bigint("impressions", { mode: "number" }).notNull().default(0),
    reach: bigint("reach", { mode: "number" }).notNull().default(0),
    clicks: bigint("clicks", { mode: "number" }).notNull().default(0),
    linkClicks: bigint("link_clicks", { mode: "number" }).notNull().default(0),
    messages: integer("messages").notNull().default(0),
    results: integer("results").notNull().default(0),
    video3s: bigint("video_3s", { mode: "number" }).notNull().default(0),
    videoP25: bigint("video_p25", { mode: "number" }).notNull().default(0),
    videoP50: bigint("video_p50", { mode: "number" }).notNull().default(0),
    videoP75: bigint("video_p75", { mode: "number" }).notNull().default(0),
    videoP100: bigint("video_p100", { mode: "number" }).notNull().default(0),
    purchaseValue: numeric("purchase_value", { precision: 16, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    publisherPlatform: text("publisher_platform").notNull().default("Facebook Ads"),
    objective: text("objective").notNull().default("Conversions"),
    ageRange: text("age_range"),
    gender: text("gender"),
    source: dataSource("source").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("insights_account_rowkey_uq").on(t.adAccountId, t.rowKey),
    index("insights_ws_date_idx").on(t.workspaceId, t.date),
  ],
);

/**
 * Per-workspace Meta Marketing API connection. Access tokens are encrypted with
 * AES-256-GCM before storage so each tenant's Meta credentials remain private.
 */
export const metaConnections = pgTable("meta_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  metaUserId: text("meta_user_id"),
  metaUserName: text("meta_user_name"),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  adAccountExternalId: text("ad_account_external_id").notNull(),
  adAccountName: text("ad_account_name").notNull().default("Meta Ad Account"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  ...timestamps,
});



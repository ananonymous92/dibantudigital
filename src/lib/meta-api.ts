import "server-only";
import { createHmac } from "node:crypto";
import type { NormalizedInsightRow } from "@/lib/import-parser";
import { env } from "@/lib/env";

const META_GRAPH_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PAGES = 40;

/**
 * Permissions that allow WRITING to the ad account / business. A reporting app
 * only needs `ads_read`, so tokens carrying these are flagged as over-privileged.
 */
const WRITE_PERMISSIONS = [
  "ads_management",
  "business_management",
  "pages_manage_ads",
  "pages_manage_posts",
  "pages_manage_metadata",
  "instagram_content_publish",
  "catalog_management",
];

const ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: "Aktif",
  2: "Dinonaktifkan",
  3: "Tagihan belum dibayar",
  7: "Dalam peninjauan risiko",
  8: "Menunggu penyelesaian",
  9: "Masa tenggang",
  100: "Menunggu ditutup",
  101: "Ditutup",
};

type MetaAction = { action_type: string; value: string };

type MetaInsightItem = {
  date_start: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
};

type GraphPaged<T> = {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
};

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
};

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/** Remove anything that looks like a Meta access token from text before showing/logging it. */
export function redactTokens(text: string): string {
  return text.replace(/EAA[A-Za-z0-9]{10,}/g, "EAA•••[disembunyikan]");
}

/**
 * HMAC-SHA256 of the access token keyed with the App Secret. When "Require App
 * Secret" is enabled in the Meta App settings, Meta rejects any call without a
 * valid proof — so a stolen token is useless outside this server.
 */
function appSecretProof(accessToken: string): string | null {
  const secret = env().META_APP_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(accessToken).digest("hex");
}

function toFriendlyError(err: GraphErrorBody["error"], status: number): MetaApiError {
  const code = err?.code;
  const raw = redactTokens(err?.message ?? `Meta API error (${status})`);

  if (code === 190) {
    return new MetaApiError(
      "Access Token tidak valid, sudah kedaluwarsa, atau sudah dicabut. Buat token baru di Meta Business Settings lalu hubungkan ulang.",
      code,
    );
  }
  if (code === 10 || code === 200 || code === 294 || (code !== undefined && code >= 200 && code < 300)) {
    return new MetaApiError(
      `Izin akses ke Ad Account ini ditolak oleh Meta (Kode #${code}: ${raw}). Silakan klik tombol "Hubungkan Ulang via Facebook" agar izin 'read_insights' & 'ads_read' diperbarui, atau pilih Ad Account lain pada dropdown.`,
      code,
    );
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80000 || code === 80004) {
    return new MetaApiError(
      "Batas permintaan (rate limit) Meta API tercapai. Tunggu beberapa menit lalu coba lagi.",
      code,
    );
  }
  if (code === 100 && /appsecret_proof/i.test(raw)) {
    return new MetaApiError(
      "Token ini dibuat dari Meta App yang berbeda dengan META_APP_SECRET server. Gunakan token dari Meta App milik DibantuDigital.",
      code,
    );
  }
  if (code === 100) {
    return new MetaApiError(`Parameter tidak valid (cek kembali Ad Account ID). Detail Meta: ${raw}`, code);
  }
  return new MetaApiError(`Meta API: ${raw}`, code);
}

/**
 * Single choke-point for every Graph API call:
 * - Token is sent in the `Authorization` header (never in the URL, so it can't leak via logs/proxies).
 * - Request is signed with `appsecret_proof` when META_APP_SECRET is configured.
 * - 30s timeout and token-redacted error messages.
 */
async function graphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${META_BASE_URL}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const proof = appSecretProof(accessToken);
  if (proof) url.searchParams.set("appsecret_proof", proof);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new MetaApiError(
      "Tidak dapat terhubung ke server Meta (timeout / jaringan). Coba lagi beberapa saat.",
    );
  }

  const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || body.error) {
    throw toFriendlyError(body.error, res.status);
  }
  return body;
}

/** Follow cursor-based pagination without ever touching `paging.next` (which embeds the token). */
async function graphGetAll<T>(
  path: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await graphGet<GraphPaged<T>>(path, accessToken, {
      ...params,
      ...(after ? { after } : {}),
    });
    out.push(...(body.data ?? []));
    after = body.paging?.cursors?.after;
    if (!body.paging?.next || !after) break;
  }
  return out;
}

function findActionValue(list: MetaAction[] | undefined, types: string[]): number {
  if (!list) return 0;
  for (const t of types) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

export function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, "");
  const digits = trimmed.startsWith("act_") ? trimmed.slice(4) : trimmed;
  return `act_${digits}`;
}

/** Ad Account IDs are purely numeric after the `act_` prefix. */
export function isValidAdAccountId(actId: string): boolean {
  return /^act_\d{5,20}$/.test(actId);
}

export type MetaConnectionCheck = {
  metaUserId: string;
  metaUserName: string;
  adAccountId: string;
  adAccountName: string;
  currency: string | null;
  accountStatusLabel: string;
  grantedPermissions: string[];
  writePermissions: string[];
  expiresAt: Date | null;
  warnings: string[];
};

/**
 * Verify a token BEFORE it is stored:
 * 1. Token is valid and identifies a Meta user / system user.
 * 2. `ads_read` is granted (and flag any write permissions — least privilege).
 * 3. The token can actually read the requested Ad Account.
 * 4. (If META_APP_ID + META_APP_SECRET are set) token belongs to our Meta App and its expiry date.
 */
export async function validateMetaConnection(params: {
  accessToken: string;
  adAccountId: string;
}): Promise<MetaConnectionCheck> {
  const { accessToken } = params;
  const actId = normalizeAdAccountId(params.adAccountId);
  const warnings: string[] = [];

  const me = await graphGet<{ id: string; name?: string }>("me", accessToken, { fields: "id,name" });

  const perms = await graphGet<GraphPaged<{ permission: string; status: string }>>(
    "me/permissions",
    accessToken,
  );
  const granted = (perms.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);

  if (!granted.includes("ads_read") && !granted.includes("ads_management")) {
    throw new MetaApiError(
      "Token belum memiliki izin 'ads_read'. Saat generate token di Meta Business Settings, centang permission ads_read.",
    );
  }
  const writePermissions = granted.filter((p) => WRITE_PERMISSIONS.includes(p));
  if (writePermissions.length > 0) {
    warnings.push(
      `Token memiliki izin tulis (${writePermissions.join(", ")}). Untuk keamanan, buat ulang token hanya dengan 'ads_read' karena aplikasi report tidak membutuhkan izin mengubah iklan.`,
    );
  }

  const account = await graphGet<{
    id: string;
    name?: string;
    currency?: string;
    account_status?: number;
  }>(actId, accessToken, { fields: "id,name,currency,account_status" });

  const accountStatusLabel = ACCOUNT_STATUS_LABEL[account.account_status ?? 1] ?? "Tidak diketahui";
  if (account.account_status !== undefined && account.account_status !== 1) {
    warnings.push(`Status Ad Account: ${accountStatusLabel}. Data mungkin tidak lengkap.`);
  }

  let expiresAt: Date | null = null;
  const { META_APP_ID, META_APP_SECRET } = env();
  if (META_APP_ID && META_APP_SECRET) {
    const debug = await graphGet<{
      data?: { app_id?: string; is_valid?: boolean; expires_at?: number; data_access_expires_at?: number };
    }>("debug_token", `${META_APP_ID}|${META_APP_SECRET}`, { input_token: accessToken });

    if (debug.data?.app_id && debug.data.app_id !== META_APP_ID) {
      throw new MetaApiError(
        "Token ini dibuat dari Meta App lain. Gunakan token yang di-generate dari Meta App DibantuDigital.",
      );
    }
    if (debug.data?.is_valid === false) {
      throw new MetaApiError("Token sudah tidak valid menurut Meta. Silakan generate token baru.");
    }
    const exp = debug.data?.expires_at ?? 0;
    expiresAt = exp > 0 ? new Date(exp * 1000) : null;
    if (expiresAt && expiresAt.getTime() - Date.now() < 7 * 86_400_000) {
      warnings.push(
        "Token akan kedaluwarsa dalam < 7 hari. Disarankan memakai System User Token dengan masa berlaku 'Never'.",
      );
    }
  } else {
    warnings.push(
      "META_APP_ID / META_APP_SECRET belum diisi di server, sehingga appsecret_proof & cek masa berlaku token belum aktif.",
    );
  }

  return {
    metaUserId: me.id,
    metaUserName: me.name ?? "Meta User",
    adAccountId: actId,
    adAccountName: account.name ?? actId,
    currency: account.currency ?? null,
    accountStatusLabel,
    grantedPermissions: granted,
    writePermissions,
    expiresAt,
    warnings,
  };
}

export type MetaAdAccountItem = {
  id: string;
  name: string;
  currency: string;
  businessName: string | null;
  statusLabel: string;
  isActive: boolean;
};

/**
 * List all Meta Ad Accounts (`act_...`) accessible by the given access token so
 * clients can pick their ad account from a dropdown instead of typing `act_...`.
 */
export async function listMetaAdAccounts(accessToken: string): Promise<MetaAdAccountItem[]> {
  const items = await graphGetAll<{
    id: string;
    account_id?: string;
    name?: string;
    currency?: string;
    business_name?: string;
    account_status?: number;
  }>("me/adaccounts", accessToken, {
    fields: "id,account_id,name,currency,business_name,account_status",
    limit: "100",
  });

  return items.map((item) => {
    const id = normalizeAdAccountId(item.id || item.account_id || "");
    const status = item.account_status ?? 1;
    return {
      id,
      name: item.name?.trim() || id,
      currency: item.currency || "IDR",
      businessName: item.business_name?.trim() || null,
      statusLabel: ACCOUNT_STATUS_LABEL[status] ?? "Aktif",
      isActive: status === 1,
    };
  });
}

/** Build the official Facebook Login OAuth URL requesting read-only `ads_read` permission. */
export function buildMetaOAuthDialogUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const { META_APP_ID, META_LOGIN_CONFIG_ID } = env();
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", params.redirectUri);
  if (META_LOGIN_CONFIG_ID) {
    // Business-type apps (Facebook Login for Business): permissions come from the configuration.
    url.searchParams.set("config_id", META_LOGIN_CONFIG_ID);
    url.searchParams.set("override_default_response_type", "true");
  } else {
    url.searchParams.set("scope", "ads_read");
  }
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  return url.toString();
}

/**
 * Exchange an OAuth `code` from Facebook Login for a 60-day Long-Lived Access Token,
 * and fetch the user's profile + accessible Ad Accounts.
 */
export async function exchangeMetaOAuthCode(params: {
  code: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  expiresAt: Date | null;
  metaUserId: string;
  metaUserName: string;
  adAccounts: MetaAdAccountItem[];
}> {
  const { META_APP_ID, META_APP_SECRET } = env();
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new MetaApiError("META_APP_ID dan META_APP_SECRET belum dikonfigurasi di server.");
  }

  // 1. Exchange authorization code for short-lived token
  const tokenUrl = new URL(`${META_BASE_URL}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", META_APP_ID);
  tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
  tokenUrl.searchParams.set("redirect_uri", params.redirectUri);
  tokenUrl.searchParams.set("code", params.code);

  const shortRes = await fetch(tokenUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const shortBody = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  } & GraphErrorBody;

  if (!shortRes.ok || shortBody.error || !shortBody.access_token) {
    throw toFriendlyError(shortBody.error, shortRes.status);
  }

  // 2. Upgrade short-lived token to a 60-day Long-Lived token
  let finalToken = shortBody.access_token;
  let expiresInSec = shortBody.expires_in ?? 60 * 86_400;

  try {
    const longUrl = new URL(`${META_BASE_URL}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", META_APP_ID);
    longUrl.searchParams.set("client_secret", META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", shortBody.access_token);

    const longRes = await fetch(longUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const longBody = (await longRes.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (longRes.ok && longBody.access_token) {
      finalToken = longBody.access_token;
      expiresInSec = longBody.expires_in ?? 60 * 86_400;
    }
  } catch {
    // Keep short-lived token if long-lived exchange fails
  }

  const expiresAt = expiresInSec > 0 ? new Date(Date.now() + expiresInSec * 1000) : null;

  // 3. Fetch profile & ad accounts accessible by this user
  const me = await graphGet<{ id: string; name?: string }>("me", finalToken, {
    fields: "id,name",
  });
  const adAccounts = await listMetaAdAccounts(finalToken);

  return {
    accessToken: finalToken,
    expiresAt,
    metaUserId: me.id,
    metaUserName: me.name ?? "Meta User",
    adAccounts,
  };
}

/**
 * Fetch daily ad-level insights and creative Instagram permalinks directly from
 * the Meta Marketing API for a date range (`since` .. `until` in YYYY-MM-DD).
 */
export async function fetchMetaAccountInsights(params: {
  adAccountId: string;
  accessToken: string;
  since: string;
  until: string;
}): Promise<{ accountName?: string; rows: NormalizedInsightRow[] }> {
  const actId = normalizeAdAccountId(params.adAccountId);

  // 1. Fetch creative Instagram permalink URLs per ad_id
  const creativeMap = new Map<string, string>();
  try {
    const ads = await graphGetAll<{ id: string; creative?: { instagram_permalink_url?: string } }>(
      `${actId}/ads`,
      params.accessToken,
      { fields: "id,name,creative{instagram_permalink_url}", limit: "250" },
    );
    for (const ad of ads) {
      if (ad.creative?.instagram_permalink_url) {
        creativeMap.set(ad.id, ad.creative.instagram_permalink_url);
      }
    }
  } catch {
    // Non-fatal: continue even if creative endpoint fails
  }

  // 2. Fetch daily insights at level=ad
  const fields = [
    "date_start",
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "objective",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "inline_link_clicks",
    "actions",
    "action_values",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p100_watched_actions",
  ].join(",");

  const items = await graphGetAll<MetaInsightItem>(`${actId}/insights`, params.accessToken, {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since: params.since, until: params.until }),
    fields,
    limit: "500",
  });

  const rows: NormalizedInsightRow[] = items.map((item) => {
    const date = item.date_start;
    const campaignName = item.campaign_name ?? "Campaign";
    const adsetName = item.adset_name ?? "Ad Set";
    const adName = item.ad_name ?? adsetName;
    const creativeUrl = (item.ad_id && creativeMap.get(item.ad_id)) ?? null;

    const spend = Number(item.spend ?? 0);
    const impressions = Math.round(Number(item.impressions ?? 0));
    const reach = Math.round(Number(item.reach ?? 0));
    const clicks = Math.round(Number(item.clicks ?? 0));
    const linkClicks = Math.round(
      item.inline_link_clicks !== undefined
        ? Number(item.inline_link_clicks)
        : findActionValue(item.actions, ["link_click"]),
    );

    const messages = Math.round(
      findActionValue(item.actions, [
        "onsite_conversion.messaging_conversation_started_7d",
        "onsite_conversion.messaging_first_reply",
        "onsite_conversion.total_messaging_connection",
        "lead",
      ]),
    );
    const video3s = Math.round(findActionValue(item.actions, ["video_view"]));
    const videoP25 = Math.round(findActionValue(item.video_p25_watched_actions, ["video_view"]));
    const videoP50 = Math.round(findActionValue(item.video_p50_watched_actions, ["video_view"]));
    const videoP75 = Math.round(findActionValue(item.video_p75_watched_actions, ["video_view"]));
    const videoP100 = Math.round(findActionValue(item.video_p100_watched_actions, ["video_view"]));
    const purchaseValue = findActionValue(item.action_values, [
      "purchase",
      "omni_purchase",
      "offsite_conversion.fb_pixel_purchase",
    ]);

    const rowKey = [
      date,
      campaignName.toLowerCase(),
      adsetName.toLowerCase(),
      adName.toLowerCase(),
      (item.ad_id ?? "").toLowerCase(),
      "facebook ads",
      "",
    ].join("|");

    return {
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
      results: messages,
      video3s,
      videoP25,
      videoP50,
      videoP75,
      videoP100,
      purchaseValue,
      publisherPlatform: "Facebook Ads",
      objective: item.objective ?? "Conversions",
      ageRange: null,
      gender: null,
    };
  });

  return { rows };
}
// ----- Additional helper functions for Business / Page selection -----
/** List Facebook Business accounts the user has access to */
export async function listMetaBusinesses(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const data = await graphGet<Array<{ id: string; name: string }>>(
    "me/businesses",
    accessToken,
    { fields: "id,name" },
  );
  // graphGet returns the raw object, but for list we use GraphPaged; using graphGetAll for pagination safety
  // Simpler: reuse graphGetAll with paging
  const paged = await graphGetAll<{ id: string; name: string }>(
    "me/businesses",
    accessToken,
    { fields: "id,name" },
  );
  return paged;
}

/** List Pages owned by a specific Business */
export async function listBusinessPages(businessId: string, accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const paged = await graphGetAll<{ id: string; name: string }>(
    `${businessId}/owned_pages`,
    accessToken,
    { fields: "id,name" },
  );
  return paged;
}

/** List Ad Accounts belonging to a Page (or Business) */
export async function listAdAccounts(parentId: string, accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const paged = await graphGetAll<{ id: string; name: string }>(
    `${parentId}/adaccounts`,
    accessToken,
    { fields: "id,name" },
  );
  return paged;
}

// Export helpers for UI (optional)
export const metaHelpers = {
  listMetaBusinesses,
  listBusinessPages,
  listAdAccounts,
};

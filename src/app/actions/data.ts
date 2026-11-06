"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import {
  normalizeSpreadsheetRows,
  parseDateString,
  parseNumber,
  readSpreadsheetBuffer,
  type NormalizedInsightRow,
} from "@/lib/import-parser";
import { buildSampleInsightRows, upsertInsightRows } from "@/lib/insights-repo";
import {
  fetchMetaAccountInsights,
  isValidAdAccountId,
  MetaApiError,
  normalizeAdAccountId,
  redactTokens,
  validateMetaConnection,
} from "@/lib/meta-api";
import { requireWorkspace } from "@/lib/tenant";

export type ActionFeedback = {
  ok?: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
};

/** Upload & import CSV / XLSX report from Meta Ads Manager or manual spreadsheet. */
export async function importSpreadsheetAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  try {
    const ctx = await requireWorkspace();
    const file = formData.get("file");
    const accountName = String(formData.get("accountName") ?? "").trim() || "Import Ads Manager";
    const replaceExisting = formData.get("replaceExisting") === "on";

    if (!(file instanceof File) || file.size === 0) {
      return { error: "Pilih file CSV atau Excel (.xlsx) terlebih dahulu." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { rows: rawRows } = readSpreadsheetBuffer(buffer);
    if (rawRows.length === 0) {
      return { error: "File kosong atau tidak memiliki baris data." };
    }

    const normalized = normalizeSpreadsheetRows(rawRows);
    if (normalized.length === 0) {
      return {
        error:
          "Tidak ditemukan kolom Tanggal / Reporting starts yang valid. Pastikan laporan menggunakan Breakdown: By Time -> Day.",
      };
    }

    const result = await upsertInsightRows({
      workspaceId: ctx.workspace.id,
      accountExternalId: `import:${accountName.toLowerCase()}`,
      accountName,
      source: "import",
      rows: normalized,
      replaceExisting,
    });

    const totalSpend = normalized.reduce((s, r) => s + r.spend, 0);
    const totalMessages = normalized.reduce((s, r) => s + r.messages, 0);

    revalidatePath("/app");
    revalidatePath("/app/performance");
    revalidatePath("/app/audience");
    revalidatePath("/app/input");

    return {
      ok: true,
      message: `Berhasil mengimpor ${result.count} baris data iklan ke akun "${accountName}" (Total Spend: Rp ${Math.round(totalSpend).toLocaleString("id-ID")} · Total Pesan: ${totalMessages.toLocaleString("id-ID")}).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengimpor file." };
  }
}

/** Add or update a single daily ad row + Nilai Deal (Omset) manually. */
export async function manualEntryAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  try {
    const ctx = await requireWorkspace();
    const date = parseDateString(formData.get("date"));
    if (!date) return { error: "Tanggal wajib diisi." };

    const campaignName = String(formData.get("campaignName") ?? "").trim() || "ABO - APPASCO";
    const adsetName = String(formData.get("adsetName") ?? "").trim() || "ALL ADSET";
    const creativeRaw = String(formData.get("creativeUrl") ?? "").trim();
    const adName = String(formData.get("adName") ?? "").trim() || creativeRaw || adsetName;
    const creativeUrl = creativeRaw.startsWith("http") ? creativeRaw : null;

    const spend = parseNumber(formData.get("spend"));
    const impressions = Math.round(parseNumber(formData.get("impressions")));
    const linkClicks = Math.round(parseNumber(formData.get("linkClicks")));
    const messages = Math.round(parseNumber(formData.get("messages")));
    const hookRatePct = parseNumber(formData.get("hookRate"));
    const videoP25 = Math.round(parseNumber(formData.get("videoP25")));
    const videoP50 = Math.round(parseNumber(formData.get("videoP50")));
    const purchaseValue = parseNumber(formData.get("purchaseValue"));
    const publisherPlatform =
      String(formData.get("publisherPlatform") ?? "").trim() || "Facebook Ads";
    const objective = String(formData.get("objective") ?? "").trim() || "Max conversion";

    const video3s =
      hookRatePct > 0 && impressions > 0 ? Math.round((hookRatePct / 100) * impressions) : videoP25;

    const rowKey = [
      date,
      campaignName.toLowerCase(),
      adsetName.toLowerCase(),
      adName.toLowerCase(),
      publisherPlatform.toLowerCase(),
      "",
      "",
    ].join("|");

    const row: NormalizedInsightRow = {
      date,
      rowKey,
      campaignName,
      adsetName,
      adName,
      creativeUrl,
      spend,
      impressions,
      reach: Math.round(impressions * 0.85),
      clicks: linkClicks,
      linkClicks,
      messages,
      results: messages,
      video3s,
      videoP25,
      videoP50,
      videoP75: Math.round(videoP50 * 0.6),
      videoP100: Math.round(videoP50 * 0.35),
      purchaseValue,
      publisherPlatform,
      objective,
      ageRange: "25-34",
      gender: "All",
    };

    await upsertInsightRows({
      workspaceId: ctx.workspace.id,
      accountExternalId: "manual:default",
      accountName: "Input Manual",
      source: "import",
      rows: [row],
    });

    revalidatePath("/app");
    revalidatePath("/app/performance");
    revalidatePath("/app/audience");
    revalidatePath("/app/input");

    return { ok: true, message: "Data iklan & Nilai Deal berhasil disimpan." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan data." };
  }
}

/** Update Nilai Deal (purchaseValue / Omset) on an existing row so ROAS recalculates immediately. */
export async function updateDealValueAction(formData: FormData) {
  const ctx = await requireWorkspace();
  const id = Number(formData.get("id"));
  const purchaseValue = parseNumber(formData.get("purchaseValue"));
  if (!Number.isFinite(id) || id <= 0) return;

  await db()
    .update(schema.adInsightsDaily)
    .set({ purchaseValue, updatedAt: new Date() })
    .where(
      and(
        eq(schema.adInsightsDaily.id, id),
        eq(schema.adInsightsDaily.workspaceId, ctx.workspace.id),
      ),
    );

  revalidatePath("/app");
  revalidatePath("/app/performance");
  revalidatePath("/app/input");
}

/** Load sample data (matching the user's real Scuto Pusat CSV) into the active workspace. */
export async function loadSampleDataAction() {
  const ctx = await requireWorkspace();
  const sampleRows = buildSampleInsightRows();
  await upsertInsightRows({
    workspaceId: ctx.workspace.id,
    accountExternalId: "demo:scuto-pusat",
    accountName: "Report Scuto Pusat (1–4 Nov 2026)",
    source: "import",
    rows: sampleRows,
    replaceExisting: true,
  });

  revalidatePath("/app");
  revalidatePath("/app/performance");
  revalidatePath("/app/audience");
  revalidatePath("/app/input");
}

/** Clear all ad insights & imported/demo data in the active workspace so the user can start fresh. */
export async function clearWorkspaceDataAction() {
  const ctx = await requireWorkspace();
  await db()
    .delete(schema.adInsightsDaily)
    .where(eq(schema.adInsightsDaily.workspaceId, ctx.workspace.id));
  await db()
    .delete(schema.adAccounts)
    .where(eq(schema.adAccounts.workspaceId, ctx.workspace.id));

  revalidatePath("/app");
  revalidatePath("/app/performance");
  revalidatePath("/app/audience");
  revalidatePath("/app/input");
}

/** Owner/Admin only — members of a workspace may view reports but never touch credentials. */
function canManageCredentials(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Minimal in-memory throttle per workspace (protects Meta rate limits and stops
 * someone hammering the token-validation endpoint). For multi-server deployments
 * replace with Redis / DB-backed limits.
 */
const throttleMap = new Map<string, number>();
function throttle(key: string, cooldownMs: number): number {
  const now = Date.now();
  const last = throttleMap.get(key) ?? 0;
  const waitMs = last + cooldownMs - now;
  if (waitMs > 0) return Math.ceil(waitMs / 1000);
  throttleMap.set(key, now);
  return 0;
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof MetaApiError) return err.message;
  if (err instanceof Error) return redactTokens(err.message);
  return fallback;
}

/**
 * Validate the token against Meta FIRST, then save it encrypted (AES-256-GCM).
 * The plain token is never returned to the browser, logged, or stored unencrypted.
 */
export async function saveMetaConnectionAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  try {
    const ctx = await requireWorkspace();
    if (!canManageCredentials(ctx.role)) {
      return { error: "Hanya Owner / Admin workspace yang boleh mengubah koneksi Meta." };
    }

    const wait = throttle(`validate:${ctx.workspace.id}`, 10_000);
    if (wait > 0) {
      return { error: `Terlalu banyak percobaan. Coba lagi dalam ${wait} detik.` };
    }

    const adAccountExternalId = normalizeAdAccountId(
      String(formData.get("adAccountExternalId") ?? ""),
    );
    const accessToken = String(formData.get("accessToken") ?? "").trim();

    if (!isValidAdAccountId(adAccountExternalId)) {
      return { error: "Ad Account ID tidak valid (contoh: act_123456789 — hanya angka setelah act_)." };
    }
    if (!/^EAA[A-Za-z0-9]{20,}$/.test(accessToken)) {
      return {
        error:
          "Format Access Token tidak valid. Token Meta diawali 'EAA' dan tidak mengandung spasi.",
      };
    }

    // 1. Verify with Meta: token valid, ads_read granted, ad account readable, app & expiry check
    const check = await validateMetaConnection({ accessToken, adAccountId: adAccountExternalId });

    const adAccountName =
      String(formData.get("adAccountName") ?? "").trim() || check.adAccountName;

    // 2. Encrypt & save (scoped to this workspace only)
    const encryptedAccessToken = encryptSecret(accessToken);
    const status = `Terverifikasi oleh Meta (${check.accountStatusLabel}) — siap sinkronisasi`;

    await db()
      .insert(schema.metaConnections)
      .values({
        workspaceId: ctx.workspace.id,
        metaUserId: check.metaUserId,
        metaUserName: check.metaUserName,
        adAccountExternalId: check.adAccountId,
        adAccountName,
        encryptedAccessToken,
        tokenExpiresAt: check.expiresAt,
        lastSyncStatus: status,
      })
      .onConflictDoUpdate({
        target: schema.metaConnections.workspaceId,
        set: {
          metaUserId: check.metaUserId,
          metaUserName: check.metaUserName,
          adAccountExternalId: check.adAccountId,
          adAccountName,
          encryptedAccessToken,
          tokenExpiresAt: check.expiresAt,
          lastSyncStatus: status,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/app/connections");
    return {
      ok: true,
      message: `Terhubung & terverifikasi: ${adAccountName} (${check.adAccountId}) sebagai "${check.metaUserName}". Token disimpan terenkripsi.`,
      warnings: check.warnings,
    };
  } catch (err) {
    return { error: safeErrorMessage(err, "Gagal menyimpan koneksi Meta.") };
  }
}

/** Remove the stored (encrypted) token for this workspace. Owner/Admin only. */
export async function disconnectMetaAction() {
  const ctx = await requireWorkspace();
  if (!canManageCredentials(ctx.role)) return;

  await db()
    .delete(schema.metaConnections)
    .where(eq(schema.metaConnections.workspaceId, ctx.workspace.id));

  revalidatePath("/app/connections");
}

/** Switch the active Ad Account from the auto-discovered dropdown list without re-entering the token. */
export async function selectMetaAdAccountAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  try {
    const ctx = await requireWorkspace();
    if (!canManageCredentials(ctx.role)) {
      return { error: "Hanya Owner / Admin workspace yang boleh memilih Ad Account." };
    }

    const raw = String(formData.get("selectedAccount") ?? "");
    const [rawId, ...nameParts] = raw.split("||");
    const adAccountExternalId = normalizeAdAccountId(rawId ?? "");
    const adAccountName = nameParts.join("||").trim() || adAccountExternalId;

    if (!isValidAdAccountId(adAccountExternalId)) {
      return { error: "Pilih Ad Account yang valid dari daftar." };
    }

    await db()
      .update(schema.metaConnections)
      .set({
        adAccountExternalId,
        adAccountName,
        lastSyncStatus: `Akun iklan dipilih: ${adAccountName} (${adAccountExternalId}) — siap sinkronisasi`,
        updatedAt: new Date(),
      })
      .where(eq(schema.metaConnections.workspaceId, ctx.workspace.id));

    revalidatePath("/app/connections");
    return {
      ok: true,
      message: `Akun iklan aktif berhasil diubah ke ${adAccountName} (${adAccountExternalId}).`,
    };
  } catch (err) {
    return { error: safeErrorMessage(err, "Gagal memilih Ad Account.") };
  }
}

/** Trigger an immediate pull from the Meta Marketing API for the workspace's connected ad account. */
export async function syncMetaNowAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  try {
    const ctx = await requireWorkspace();
    if (!ctx.access.hasAccess) {
      return { error: "Langganan workspace tidak aktif. Perpanjang paket untuk menarik data dari Meta." };
    }

    const today = new Date().toISOString().slice(0, 10);
    const since =
      parseDateString(formData.get("since")) ??
      new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const until = parseDateString(formData.get("until")) ?? today;

    if (since > until) {
      return { error: "Tanggal awal tidak boleh lebih besar dari tanggal akhir." };
    }
    const spanDays = (Date.parse(until) - Date.parse(since)) / 86_400_000 + 1;
    if (spanDays > 93) {
      return { error: "Maksimal rentang sinkronisasi 93 hari per tarikan. Pecah menjadi beberapa periode." };
    }

    const wait = throttle(`sync:${ctx.workspace.id}`, 60_000);
    if (wait > 0) {
      return { error: `Sinkronisasi baru saja dijalankan. Coba lagi dalam ${wait} detik.` };
    }

    const connRows = await db()
      .select()
      .from(schema.metaConnections)
      .where(eq(schema.metaConnections.workspaceId, ctx.workspace.id))
      .limit(1);
    const conn = connRows[0];
    if (!conn) {
      return { error: "Belum ada koneksi Meta pada workspace ini." };
    }
    if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now()) {
      return { error: "Access Token Meta sudah kedaluwarsa. Hubungkan ulang dengan token baru." };
    }

    const accessToken = decryptSecret(conn.encryptedAccessToken);
    let rows: NormalizedInsightRow[];
    try {
      ({ rows } = await fetchMetaAccountInsights({
        adAccountId: conn.adAccountExternalId,
        accessToken,
        since,
        until,
      }));
    } catch (err) {
      const message = safeErrorMessage(err, "Gagal sinkronisasi dari Meta API.");
      await db()
        .update(schema.metaConnections)
        .set({ lastSyncStatus: `Gagal: ${message}`, updatedAt: new Date() })
        .where(eq(schema.metaConnections.id, conn.id));
      revalidatePath("/app/connections");
      return { error: message };
    }

    const result = await upsertInsightRows({
      workspaceId: ctx.workspace.id,
      accountExternalId: conn.adAccountExternalId,
      accountName: conn.adAccountName,
      source: "meta_api",
      rows,
    });

    await db()
      .update(schema.metaConnections)
      .set({
        lastSyncedAt: new Date(),
        lastSyncStatus: `Berhasil tarik ${result.count} baris (${since} s/d ${until})`,
        updatedAt: new Date(),
      })
      .where(eq(schema.metaConnections.id, conn.id));

    revalidatePath("/app");
    revalidatePath("/app/performance");
    revalidatePath("/app/connections");

    return {
      ok: true,
      message: `Sinkronisasi Meta API selesai: ${result.count} baris berhasil diperbarui.`,
    };
  } catch (err) {
    return { error: safeErrorMessage(err, "Gagal sinkronisasi dari Meta API.") };
  }
}


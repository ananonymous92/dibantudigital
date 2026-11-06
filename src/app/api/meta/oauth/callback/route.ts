import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { encryptSecret } from "@/lib/crypto";
import { exchangeMetaOAuthCode, redactTokens } from "@/lib/meta-api";
import { requireWorkspace } from "@/lib/tenant";
import { getPublicBaseUrl } from "@/lib/url";
import { OAUTH_STATE_COOKIE } from "../start/route";

/**
 * Step 2 of 1-Click Facebook OAuth:
 * Validates CSRF state, exchanges code for a 60-day Long-Lived Access Token,
 * auto-detects the client's Ad Accounts, encrypts the token with AES-256-GCM,
 * and saves it to the active workspace.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireWorkspace();
  const baseUrl = await getPublicBaseUrl();
  const baseRedirect = (query: string) =>
    NextResponse.redirect(new URL(`/app/connections?${query}`, baseUrl));

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return baseRedirect("oauth_error=forbidden");
  }

  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const fbError = sp.get("error_description") || sp.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (fbError) {
    return baseRedirect(`oauth_error=${encodeURIComponent(redactTokens(fbError))}`);
  }

  if (!state || !storedState || state !== storedState || !state.startsWith(`${ctx.workspace.id}.`)) {
    return baseRedirect("oauth_error=invalid_state");
  }

  if (!code) {
    return baseRedirect("oauth_error=missing_code");
  }

  try {
    const redirectUri = `${baseUrl}/api/meta/oauth/callback`;
    const result = await exchangeMetaOAuthCode({ code, redirectUri });

    if (result.adAccounts.length === 0) {
      return baseRedirect("oauth_error=no_ad_accounts");
    }

    // Pick the first active Ad Account by default; client can switch via dropdown anytime.
    const chosen = result.adAccounts.find((a) => a.isActive) ?? result.adAccounts[0];
    const encryptedAccessToken = encryptSecret(result.accessToken);
    const status = `Terhubung via Facebook Login (${chosen.statusLabel}) — ${result.adAccounts.length} Ad Account ditemukan`;

    await db()
      .insert(schema.metaConnections)
      .values({
        workspaceId: ctx.workspace.id,
        metaUserId: result.metaUserId,
        metaUserName: result.metaUserName,
        adAccountExternalId: chosen.id,
        adAccountName: chosen.name,
        encryptedAccessToken,
        tokenExpiresAt: result.expiresAt,
        lastSyncStatus: status,
      })
      .onConflictDoUpdate({
        target: schema.metaConnections.workspaceId,
        set: {
          metaUserId: result.metaUserId,
          metaUserName: result.metaUserName,
          adAccountExternalId: chosen.id,
          adAccountName: chosen.name,
          encryptedAccessToken,
          tokenExpiresAt: result.expiresAt,
          lastSyncStatus: status,
          updatedAt: new Date(),
        },
      });

    return baseRedirect("oauth=connected");
  } catch (err) {
    const msg = err instanceof Error ? redactTokens(err.message) : "Gagal menghubungkan Facebook";
    return baseRedirect(`oauth_error=${encodeURIComponent(msg)}`);
  }
}

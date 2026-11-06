import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildMetaOAuthDialogUrl } from "@/lib/meta-api";
import { requireWorkspace } from "@/lib/tenant";
import { getPublicBaseUrl } from "@/lib/url";

export const OAUTH_STATE_COOKIE = "dd_meta_oauth_state";

/**
 * Step 1 of 1-Click Facebook OAuth:
 * Redirects the client to Facebook's official OAuth dialog requesting read-only
 * `ads_read` permission, protected with a workspace-bound CSRF state cookie.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  const { META_APP_ID, META_APP_SECRET } = env();
  const baseUrl = await getPublicBaseUrl();

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.redirect(
      new URL("/app/connections?oauth_error=forbidden", baseUrl),
    );
  }

  if (!META_APP_ID || !META_APP_SECRET) {
    return NextResponse.redirect(
      new URL("/app/connections?oauth_error=missing_app_config", baseUrl),
    );
  }

  const nonce = randomBytes(24).toString("hex");
  const state = `${ctx.workspace.id}.${nonce}`;
  const redirectUri = `${baseUrl}/api/meta/oauth/callback`;

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl.startsWith("https://"),
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const dialogUrl = buildMetaOAuthDialogUrl({ redirectUri, state });
  return NextResponse.redirect(dialogUrl);
}

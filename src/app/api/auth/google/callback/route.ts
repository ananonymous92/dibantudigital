import { eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getPublicBaseUrl } from "@/lib/url";
import { GOOGLE_OAUTH_STATE_COOKIE } from "../start/route";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
};

/**
 * Google OAuth 2.0 callback:
 * - Validates CSRF state cookie
 * - Exchanges code for access_token and fetches Google user profile
 * - Matches existing user by google_id or email, or creates a new verified user
 * - Starts session and routes first-time users to /onboarding to name their brand
 */
export async function GET(request: NextRequest) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  const baseUrl = await getPublicBaseUrl();
  const loginRedirect = (query: string) =>
    NextResponse.redirect(new URL(`/login?${query}`, baseUrl));

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return loginRedirect("oauth_error=google_not_configured");
  }

  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  if (oauthError) {
    return loginRedirect("oauth_error=google_cancelled");
  }

  if (!state || !storedState || state !== storedState) {
    return loginRedirect("oauth_error=invalid_state");
  }

  if (!code) {
    return loginRedirect("oauth_error=missing_code");
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      return loginRedirect("oauth_error=google_token_failed");
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = (await userRes.json()) as GoogleUserInfo;
    const email = profile.email?.trim().toLowerCase();
    const googleId = profile.sub?.trim();

    if (!userRes.ok || !email || !googleId) {
      return loginRedirect("oauth_error=google_profile_failed");
    }

    const displayName =
      profile.name?.trim() ||
      profile.given_name?.trim() ||
      email.split("@")[0] ||
      "Pengguna";

    const now = new Date();
    const existingRows = await db()
      .select({
        id: schema.users.id,
        googleId: schema.users.googleId,
        emailVerifiedAt: schema.users.emailVerifiedAt,
      })
      .from(schema.users)
      .where(or(eq(schema.users.googleId, googleId), eq(schema.users.email, email)))
      .limit(1);

    let userId: string;

    if (existingRows[0]) {
      userId = existingRows[0].id;
      await db()
        .update(schema.users)
        .set({
          googleId: existingRows[0].googleId ?? googleId,
          emailVerifiedAt: existingRows[0].emailVerifiedAt ?? now,
          updatedAt: now,
        })
        .where(eq(schema.users.id, userId));
    } else {
      const [created] = await db()
        .insert(schema.users)
        .values({
          name: displayName,
          email,
          passwordHash: "",
          googleId,
          emailVerifiedAt: now,
        })
        .returning({ id: schema.users.id });
      userId = created.id;
    }

    // Check if the user already has a workspace; if not, /onboarding will ask for their brand name.
    const membership = await db()
      .select({ workspaceId: schema.workspaceMembers.workspaceId })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, userId))
      .limit(1);

    const activeWorkspaceId = membership[0]?.workspaceId ?? null;
    await createSession(userId, activeWorkspaceId);

    return NextResponse.redirect(
      new URL(activeWorkspaceId ? "/app" : "/onboarding", baseUrl),
    );
  } catch (err) {
    console.error("[auth/google/callback] error:", err);
    return loginRedirect("oauth_error=google_server_error");
  }
}

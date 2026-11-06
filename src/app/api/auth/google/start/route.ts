import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const GOOGLE_OAUTH_STATE_COOKIE = "dd_google_oauth_state";

/**
 * Initiates Google OAuth 2.0 Sign-In / Sign-Up.
 * Redirects to Google's authorization endpoint with a CSRF state cookie.
 */
export async function GET() {
  const { APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NODE_ENV } = env();
  const baseUrl = APP_URL.replace(/\/$/, "");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/login?oauth_error=google_not_configured", baseUrl),
    );
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(url.toString());
}


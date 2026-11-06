import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { createSession, getSession } from "@/lib/auth/session";
import { verifyEmailWithToken } from "@/lib/auth/tokens";
import { env } from "@/lib/env";

/**
 * Handles clicking the verification link in the user's email:
 * GET /api/auth/verify-email?token=...
 */
export async function GET(request: NextRequest) {
  const baseUrl = env().APP_URL.replace(/\/$/, "");
  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid_token", baseUrl));
  }

  const result = await verifyEmailWithToken(token);
  if (!result.ok || !result.userId) {
    return NextResponse.redirect(new URL("/verify-email?error=expired_token", baseUrl));
  }

  // If the user is not currently logged in on this browser, log them in automatically.
  const currentSession = await getSession();
  if (!currentSession || currentSession.user.id !== result.userId) {
    const membership = await db()
      .select({ workspaceId: schema.workspaceMembers.workspaceId })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, result.userId))
      .limit(1);
    await createSession(result.userId, membership[0]?.workspaceId ?? null);
  }

  return NextResponse.redirect(new URL("/app?verified=1", baseUrl));
}


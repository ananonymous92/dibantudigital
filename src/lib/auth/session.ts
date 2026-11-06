import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "dd_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a session row and set the session cookie. Call only from Server Actions / Route Handlers. */
export async function createSession(userId: string, activeWorkspaceId: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();

  await db()
    .insert(schema.sessions)
    .values({
      id: hashToken(token),
      userId,
      activeWorkspaceId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Delete the current session (if any) and clear the cookie. */
export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db().delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  sessionId: string;
  activeWorkspaceId: string | null;
  user: { id: string; name: string; email: string; isPlatformAdmin: boolean };
};

/** Resolve the logged-in user from the session cookie. Memoised per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  let rows;
  try {
    rows = await db()
      .select({
        sessionId: schema.sessions.id,
        expiresAt: schema.sessions.expiresAt,
        activeWorkspaceId: schema.sessions.activeWorkspaceId,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        isPlatformAdmin: schema.users.isPlatformAdmin,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(eq(schema.sessions.id, id))
      .limit(1);
  } catch {
    return null;
  }

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db().delete(schema.sessions).where(eq(schema.sessions.id, id));
    return null;
  }

  return {
    sessionId: row.sessionId,
    activeWorkspaceId: row.activeWorkspaceId,
    user: { id: row.userId, name: row.name, email: row.email, isPlatformAdmin: row.isPlatformAdmin },
  };
});

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Switch the active workspace of the current session, after verifying membership. */
export async function setActiveWorkspace(workspaceId: string): Promise<boolean> {
  const session = await requireSession();
  const member = await db()
    .select({ workspaceId: schema.workspaceMembers.workspaceId })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!member[0]) return false;

  await db()
    .update(schema.sessions)
    .set({ activeWorkspaceId: workspaceId })
    .where(eq(schema.sessions.id, session.sessionId));
  return true;
}


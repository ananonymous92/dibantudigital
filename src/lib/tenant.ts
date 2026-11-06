import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession, type SessionUser } from "@/lib/auth/session";
import { computeAccess, type AccessState } from "@/lib/billing/access";

export type WorkspaceContext = {
  session: SessionUser;
  workspace: typeof schema.workspaces.$inferSelect;
  role: "owner" | "admin" | "member";
  workspaces: { id: string; name: string }[];
  subscription: (typeof schema.subscriptions.$inferSelect & { planName: string; planCode: string }) | null;
  access: AccessState;
};

/**
 * Resolve the tenant (workspace) for the current request. Every data query in
 * the app must be scoped with `ctx.workspace.id` from this function.
 */
export const requireWorkspace = cache(async (): Promise<WorkspaceContext> => {
  const session = await requireSession();

  const memberships = await db()
    .select({ workspace: schema.workspaces, role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(eq(schema.workspaceMembers.userId, session.user.id))
    .orderBy(asc(schema.workspaceMembers.createdAt));

  if (memberships.length === 0) redirect("/onboarding");

  const current =
    memberships.find((m) => m.workspace.id === session.activeWorkspaceId) ?? memberships[0];

  const subRows = await db()
    .select({
      sub: schema.subscriptions,
      planName: schema.plans.name,
      planCode: schema.plans.code,
    })
    .from(schema.subscriptions)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
    .where(eq(schema.subscriptions.workspaceId, current.workspace.id))
    .limit(1);

  const subscription = subRows[0]
    ? { ...subRows[0].sub, planName: subRows[0].planName, planCode: subRows[0].planCode }
    : null;

  return {
    session,
    workspace: current.workspace,
    role: current.role,
    workspaces: memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name })),
    subscription,
    access: computeAccess(subscription),
  };
});


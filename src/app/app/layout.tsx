import Link from "next/link";
import { LogOut, ShieldAlert } from "lucide-react";
import { logoutAction, switchWorkspaceAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { Badge } from "@/components/ui";
import { requireWorkspace } from "@/lib/tenant";
import { daysUntil } from "@/lib/utils";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const remainingDays = ctx.access.endsAt ? daysUntil(ctx.access.endsAt) : 0;

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      {/* Dark navy sidebar matching Photo 1 */}
      <aside className="flex w-64 shrink-0 flex-col justify-between bg-sidebar px-4 py-6 text-slate-200">
        <div>
          <div className="px-2">
            <Logo dark />
          </div>

          {/* Workspace selector & subscription badge */}
          <div className="mt-6 rounded-xl bg-slate-800/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-white">{ctx.workspace.name}</p>
              {ctx.access.hasAccess ? (
                <Badge tone={ctx.access.kind === "trial" ? "brand" : "success"}>
                  {ctx.access.kind === "trial"
                    ? `Trial · ${remainingDays}h`
                    : `${ctx.subscription?.planName ?? "Pro"} · ${remainingDays}h`}
                </Badge>
              ) : (
                <Badge tone="danger">Expired</Badge>
              )}
            </div>

            {ctx.workspaces.length > 1 && (
              <form action={switchWorkspaceAction} className="mt-2 flex gap-1.5">
                <select
                  name="workspaceId"
                  defaultValue={ctx.workspace.id}
                  className="w-full rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-200"
                >
                  {ctx.workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Pilih
                </button>
              </form>
            )}
          </div>

          <div className="mt-6">
            <SidebarNav />
          </div>
        </div>

        {/* User profile & logout */}
        <div className="border-t border-slate-800 pt-4">
          <div className="px-2">
            <p className="truncate text-xs font-semibold text-white">{ctx.session.user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{ctx.session.user.email}</p>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="size-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!ctx.access.hasAccess && (
          <div className="flex items-center justify-between gap-4 bg-amber-500 px-6 py-2.5 text-xs font-semibold text-slate-950">
            <span className="inline-flex items-center gap-2">
              <ShieldAlert className="size-4" />
              Masa aktif langganan workspace ini telah berakhir. Perpanjang paket (1 / 3 / 6 / 12 bulan) untuk melanjutkan sinkronisasi otomatis.
            </span>
            <Link
              href="/app/billing"
              className="rounded-lg bg-slate-950 px-3 py-1 text-white hover:bg-slate-800"
            >
              Perpanjang Sekarang
            </Link>
          </div>
        )}
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}


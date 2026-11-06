import type { Metadata } from "next";
import { getWorkspaceDashboardData } from "@/lib/insights-repo";
import { requireWorkspace } from "@/lib/tenant";
import { formatIDR } from "@/lib/utils";

export const metadata: Metadata = { title: "Audience Analytics" };

export default async function AudiencePage() {
  const ctx = await requireWorkspace();
  const data = await getWorkspaceDashboardData({ workspaceId: ctx.workspace.id });
  const totalSpend = data.summary.spend;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Audience & Placement Analytics</h1>
        <p className="text-xs text-slate-500">
          Distribusi belanja iklan, konversi pesan, dan ROAS berdasarkan segmen usia, gender, dan platform.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Age & Gender breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">Segmen Usia & Gender</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Usia</th>
                  <th className="px-3 py-2.5">Gender</th>
                  <th className="px-3 py-2.5 text-right">Spend</th>
                  <th className="px-3 py-2.5 text-right">Impressions</th>
                  <th className="px-3 py-2.5 text-right">CTR</th>
                  <th className="px-3 py-2.5 text-right">Pesan</th>
                  <th className="py-2.5 pl-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byAudience.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada data audiens.
                    </td>
                  </tr>
                ) : (
                  data.byAudience.map((a) => (
                    <tr key={`${a.ageRange}-${a.gender}`}>
                      <td className="py-3 pr-3 font-semibold text-slate-900">{a.ageRange}</td>
                      <td className="px-3 py-3 text-slate-600">{a.gender}</td>
                      <td className="px-3 py-3 text-right font-medium text-slate-900">
                        {formatIDR(a.spend)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {a.impressions.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{a.ctr.toFixed(2)}%</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">
                        {a.messages}
                      </td>
                      <td className="py-3 pl-3 text-right font-bold text-blue-600">
                        {a.roas.toFixed(2)}x
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">Performa per Platform (FB vs IG)</h2>
          <div className="mt-4 space-y-4">
            {data.byPlatform.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Belum ada data platform.</p>
            ) : (
              data.byPlatform.map((p) => {
                const share = totalSpend > 0 ? Math.round((p.spend / totalSpend) * 100) : 0;
                return (
                  <div key={p.platform} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{p.platform}</span>
                      <span className="font-semibold text-brand-600">{share}% dari total spend</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${Math.max(5, share)}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-slate-600">
                      <div>
                        <p className="text-slate-400">Spend</p>
                        <p className="font-semibold text-slate-900">{formatIDR(p.spend)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">CTR</p>
                        <p className="font-semibold text-slate-900">{p.ctr.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400">CPA</p>
                        <p className="font-semibold text-slate-900">{formatIDR(p.cpa)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">ROAS</p>
                        <p className="font-bold text-blue-600">{p.roas.toFixed(2)}x</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already logged in: go straight to the app.
  if (await getSession()) redirect("/app");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          {children}
        </div>
      </div>
      <div className="hidden flex-col justify-center bg-sidebar p-12 text-white lg:flex">
        <h2 className="text-3xl font-bold leading-tight">
          Laporan Meta Ads otomatis,
          <br />
          tanpa rekap manual.
        </h2>
        <ul className="mt-8 space-y-3 text-slate-300">
          <li>✓ Tarik data langsung dari akun Meta Anda</li>
          <li>✓ Import file export Ads Manager (CSV/XLSX)</li>
          <li>✓ ROAS, CPA, Hook Rate & performa creative</li>
          <li>✓ AI Insights untuk rekomendasi optimasi</li>
        </ul>
      </div>
    </div>
  );
}

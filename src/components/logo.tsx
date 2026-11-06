import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
        <BarChart3 className="size-4" />
      </span>
      <span className={cn("text-lg tracking-tight", dark ? "text-white" : "text-slate-900")}>
        Dibantu<span className="text-brand-500">Digital</span>
      </span>
    </Link>
  );
}


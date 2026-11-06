"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  TrendingUp,
  Users,
  CloudUpload,
  PlugZap,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/app/performance", label: "Performance", icon: TrendingUp },
  { href: "/app/audience", label: "Audience Analytics", icon: Users },
  { href: "/app/input", label: "Input Data Iklan", icon: CloudUpload },
  { href: "/app/connections", label: "Koneksi Meta API", icon: PlugZap },
  { href: "/app/billing", label: "Langganan & Billing", icon: CreditCard },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}


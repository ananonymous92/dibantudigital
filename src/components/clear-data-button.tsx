"use client";

import { Trash2 } from "lucide-react";
import { clearWorkspaceDataAction } from "@/app/actions/data";

export function ClearDataButton() {
  return (
    <form
      action={clearWorkspaceDataAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Kosongkan seluruh data iklan di workspace ini? (Akun & langganan Anda tetap aman)",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
      >
        <Trash2 className="size-3.5" />
        Kosongkan Data
      </button>
    </form>
  );
}


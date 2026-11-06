"use client";

import { useActionState } from "react";
import { Unplug } from "lucide-react";
import {
  disconnectMetaAction,
  saveMetaConnectionAction,
  selectMetaAdAccountAction,
  syncMetaNowAction,
  type ActionFeedback,
} from "@/app/actions/data";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Input, Label } from "@/components/ui";
import type { MetaAdAccountItem } from "@/lib/meta-api";

export function SelectAdAccountForm({
  accounts,
  currentAccountId,
  canManage,
}: {
  accounts: MetaAdAccountItem[];
  currentAccountId: string;
  canManage: boolean;
}) {
  const [state, action] = useActionState<ActionFeedback, FormData>(
    selectMetaAdAccountAction,
    {},
  );

  if (!canManage || accounts.length === 0) return null;

  const defaultVal =
    accounts
      .map((a) => `${a.id}||${a.name}`)
      .find((v) => v.startsWith(`${currentAccountId}||`)) ??
    `${accounts[0].id}||${accounts[0].name}`;

  return (
    <form action={action} className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3.5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div>
        <Label htmlFor="selectedAccount">
          Pilih Akun Iklan (Ad Account) dari Facebook Anda ({accounts.length} akun ditemukan)
        </Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select
            id="selectedAccount"
            name="selectedAccount"
            defaultValue={defaultVal}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-brand-600 focus:outline-none"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={`${acc.id}||${acc.name}`}>
                {acc.name} ({acc.id}) — {acc.currency} · {acc.statusLabel}
                {acc.businessName ? ` [${acc.businessName}]` : ""}
              </option>
            ))}
          </select>
          <SubmitButton className="w-auto px-4 py-2 text-xs">
            Gunakan Akun Iklan Ini
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function SaveMetaConnectionForm({
  defaultAccountId,
  defaultAccountName,
  canManage,
}: {
  defaultAccountId?: string;
  defaultAccountName?: string;
  canManage: boolean;
}) {
  const [state, action] = useActionState<ActionFeedback, FormData>(saveMetaConnectionAction, {});

  if (!canManage) {
    return (
      <Alert tone="info">
        Hanya Owner / Admin workspace yang dapat menambahkan atau mengganti Access Token Meta.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4" autoComplete="off">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {state.warnings && state.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">Rekomendasi keamanan:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="adAccountExternalId">Meta Ad Account ID</Label>
          <Input
            id="adAccountExternalId"
            name="adAccountExternalId"
            defaultValue={defaultAccountId ?? ""}
            placeholder="act_1234567890"
            inputMode="numeric"
            required
          />
        </div>
        <div>
          <Label htmlFor="adAccountName">Nama Bisnis / Ad Account (opsional)</Label>
          <Input
            id="adAccountName"
            name="adAccountName"
            defaultValue={defaultAccountName ?? ""}
            placeholder="Otomatis diambil dari Meta"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="accessToken">System User Access Token (permission: ads_read)</Label>
        <Input
          id="accessToken"
          name="accessToken"
          type="password"
          placeholder={defaultAccountId ? "Tempel token baru untuk mengganti token lama" : "EAAG..."}
          autoComplete="new-password"
          spellCheck={false}
          required
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Token diverifikasi langsung ke Meta, lalu dienkripsi AES-256-GCM. Token tidak pernah ditampilkan kembali ke browser.
        </p>
      </div>

      <SubmitButton>Verifikasi & Simpan Koneksi (Terenkripsi)</SubmitButton>
    </form>
  );
}

export function DisconnectMetaButton() {
  return (
    <form
      action={disconnectMetaAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Putuskan koneksi Meta? Token terenkripsi akan dihapus permanen dari server (data laporan yang sudah ditarik tetap aman).",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
      >
        <Unplug className="size-3.5" />
        Putuskan Koneksi & Hapus Token
      </button>
    </form>
  );
}

export function SyncMetaNowForm({
  defaultSince,
  defaultUntil,
}: {
  defaultSince: string;
  defaultUntil: string;
}) {
  const [state, action] = useActionState<ActionFeedback, FormData>(syncMetaNowAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="since">Dari Tanggal</Label>
          <Input
            id="since"
            name="since"
            type="date"
            defaultValue={defaultSince}
            max={defaultUntil}
            required
          />
        </div>
        <div>
          <Label htmlFor="until">Sampai Tanggal</Label>
          <Input
            id="until"
            name="until"
            type="date"
            defaultValue={defaultUntil}
            max={defaultUntil}
            required
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Maksimal 93 hari per tarikan · jeda minimal 60 detik antar sinkronisasi.</p>

      <SubmitButton>Tarik Data dari Meta API Sekarang</SubmitButton>
    </form>
  );
}

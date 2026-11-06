"use client";

import { useActionState } from "react";
import {
  importSpreadsheetAction,
  manualEntryAction,
  type ActionFeedback,
} from "@/app/actions/data";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Input, Label } from "@/components/ui";

export function ImportSpreadsheetForm() {
  const [state, action] = useActionState<ActionFeedback, FormData>(importSpreadsheetAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div>
        <Label htmlFor="accountName">Label Akun / Sumber Data</Label>
        <Input
          id="accountName"
          name="accountName"
          defaultValue="Meta Ads - Scuto Pusat"
          placeholder="mis. Akun Meta Utama"
        />
      </div>

      <div>
        <Label htmlFor="file">File Export Meta Ads Manager / Spreadsheet (.xlsx, .xls, .csv)</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,.xlsx,.xls"
          required
          className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-700"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Mendukung penuh file CSV/XLSX Meta Ads Manager (kolom{" "}
          <strong>Tanggal, Nama kampanye, Nama set iklan, Iklan, Penempatan, Jumlah yang dibelanjakan, Impresi, Klik, Percakapan pesan dimulai, Video 25%/50%/3 detik</strong>) maupun format spreadsheet manual.
        </p>
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          name="replaceExisting"
          defaultChecked
          className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
        />
        <span>
          <strong className="font-semibold text-slate-900">
            Ganti / bersihkan data import sebelumnya (Disarankan)
          </strong>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Menghapus baris lama sebelum memasukkan file ini agar total Spend, Impressions, dan Pesan 100% sama persis dengan isi file CSV yang baru di-upload.
          </span>
        </span>
      </label>

      <SubmitButton>Upload & Proses Laporan</SubmitButton>
    </form>
  );
}

export function ManualRowForm() {
  const [state, action] = useActionState<ActionFeedback, FormData>(manualEntryAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="date">Tanggal</Label>
          <Input id="date" name="date" type="date" defaultValue="2026-11-01" required />
        </div>
        <div>
          <Label htmlFor="campaignName">Campaign</Label>
          <Input
            id="campaignName"
            name="campaignName"
            placeholder="ABO - APPASCO"
            defaultValue="ABO - APPASCO"
            required
          />
        </div>
        <div>
          <Label htmlFor="adsetName">Adset</Label>
          <Input
            id="adsetName"
            name="adsetName"
            placeholder="JABODETABAKE 24-54"
            defaultValue="JABODETABAKE 24-54"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="creativeUrl">Creative Link (Instagram / Post URL)</Label>
          <Input
            id="creativeUrl"
            name="creativeUrl"
            placeholder="https://www.instagram.com/p/DfTkqJRBmiH/"
          />
        </div>
        <div>
          <Label htmlFor="publisherPlatform">Platform / Source</Label>
          <select
            id="publisherPlatform"
            name="publisherPlatform"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="Instagram Ads">Instagram Ads</option>
            <option value="Facebook Ads">Facebook Ads</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="spend">Amount Spend (Rp)</Label>
          <Input id="spend" name="spend" type="number" defaultValue="100000" required />
        </div>
        <div>
          <Label htmlFor="impressions">Impression</Label>
          <Input id="impressions" name="impressions" type="number" defaultValue="2000" required />
        </div>
        <div>
          <Label htmlFor="linkClicks">Click</Label>
          <Input id="linkClicks" name="linkClicks" type="number" defaultValue="20" required />
        </div>
        <div>
          <Label htmlFor="messages">MESSAGE (Pesan)</Label>
          <Input id="messages" name="messages" type="number" defaultValue="1" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="hookRate">Hook Rate (%)</Label>
          <Input id="hookRate" name="hookRate" type="number" step="0.1" defaultValue="3" />
        </div>
        <div>
          <Label htmlFor="videoP25">Iklan Ditonton 25%</Label>
          <Input id="videoP25" name="videoP25" type="number" defaultValue="60" />
        </div>
        <div>
          <Label htmlFor="videoP50">Iklan Ditonton 50%</Label>
          <Input id="videoP50" name="videoP50" type="number" defaultValue="20" />
        </div>
        <div>
          <Label htmlFor="purchaseValue">Nilai Deal / Omset (Rp)</Label>
          <Input id="purchaseValue" name="purchaseValue" type="number" defaultValue="1000000" />
        </div>
      </div>

      <SubmitButton>Simpan Baris & Hitung ROAS Otomatis</SubmitButton>
    </form>
  );
}


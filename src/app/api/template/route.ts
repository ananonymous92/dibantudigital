import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

/**
 * Download a sample Excel (.xlsx) template matching both the user's manual
 * spreadsheet (Photo 5) and Meta Ads Manager export columns.
 */
export async function GET() {
  const sampleRows = [
    {
      Tanggal: "2026-11-01",
      Campaign: "ABO - APPASCO",
      Adset: "JABODETABAKE 24-54",
      Creative: "https://www.instagram.com/p/DfTkqJRBmiH/",
      "Amount Spend": 100000,
      Impression: 2000,
      Click: 20,
      CTR: "1.00%",
      CPC: 5000,
      CPM: 50000,
      MESSAGE: 1,
      CPA: 100000,
      "Hook Rate": "3%",
      "Iklan Ditonton 25%": 60,
      "Iklan Ditonton 50%": 20,
      "Nilai Deal": 1000000,
      ROAS: "10.00x",
    },
    {
      Tanggal: "2026-11-02",
      Campaign: "CBO - RETARGETING WA",
      Adset: "WARM AUDIENCE 30D",
      Creative: "https://www.instagram.com/p/C9xLmPqR7aB/",
      "Amount Spend": 150000,
      Impression: 3200,
      Click: 48,
      CTR: "1.50%",
      CPC: 3125,
      CPM: 46875,
      MESSAGE: 6,
      CPA: 25000,
      "Hook Rate": "4.5%",
      "Iklan Ditonton 25%": 144,
      "Iklan Ditonton 50%": 72,
      "Nilai Deal": 850000,
      ROAS: "5.67x",
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, "Report Ads 2026");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template-Report-Ads-DibantuDigital.xlsx"',
    },
  });
}


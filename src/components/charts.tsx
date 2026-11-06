"use client";

import type { ComputedMetrics } from "@/lib/metrics";
import { formatCompactNumber } from "@/lib/metrics";
import { formatIDR } from "@/lib/utils";

type DailyPoint = ComputedMetrics & { date: string; label: string };

const W = 560;
const H = 210;
const PAD = { top: 18, right: 44, bottom: 32, left: 48 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function xAt(index: number, count: number): number {
  if (count <= 1) return PAD.left + PLOT_W / 2;
  return PAD.left + (index / (count - 1)) * PLOT_W;
}

function yAt(value: number, max: number): number {
  const safeMax = max > 0 ? max : 1;
  return PAD.top + PLOT_H - Math.min(1, Math.max(0, value / safeMax)) * PLOT_H;
}

function polylinePoints(values: number[], max: number): string {
  return values
    .map((v, i) => `${xAt(i, values.length).toFixed(1)},${yAt(v, max).toFixed(1)}`)
    .join(" ");
}

/**
 * 4 time-series charts matching Photo 2:
 * 1. Amount spent by Date (green line)
 * 2. Impressions and Clicks by Date (dual line: blue + rust)
 * 3. Impressions and CTR over time (teal bars + gold line)
 * 4. Clicks and performance over time (rust bars + grey CPC line)
 */
export function TimeSeriesChartsGrid({ series }: { series: DailyPoint[] }) {
  if (series.length === 0) {
    return null;
  }

  const spends = series.map((d) => d.spend);
  const impressions = series.map((d) => d.impressions);
  const clicks = series.map((d) => d.linkClicks || d.clicks);
  const ctrs = series.map((d) => d.ctr);
  const cpcs = series.map((d) => d.cpc);

  const maxSpend = Math.max(...spends, 1) * 1.15;
  const maxImp = Math.max(...impressions, 1) * 1.15;
  const maxClk = Math.max(...clicks, 1) * 1.2;
  const maxCtr = Math.max(...ctrs, 1) * 1.2;
  const maxCpc = Math.max(...cpcs, 1) * 1.2;

  const barWidth = Math.max(8, Math.min(22, PLOT_W / Math.max(series.length * 1.7, 1)));
  const labelStep = Math.max(1, Math.ceil(series.length / 7));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* 1. Amount spent by Date */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Amount spent by Date</h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-0.5 w-3 bg-emerald-600" /> Amount spent
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.top + PLOT_H * (1 - t);
            const val = maxSpend * t;
            return (
              <g key={t}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {formatCompactNumber(val)}
                </text>
              </g>
            );
          })}
          <polyline
            fill="none"
            stroke="#16a34a"
            strokeWidth="2.2"
            points={polylinePoints(spends, maxSpend)}
          />
          {series.map((d, i) => (
            <g key={d.date}>
              <circle
                cx={xAt(i, series.length)}
                cy={yAt(d.spend, maxSpend)}
                r="3"
                className="fill-emerald-600"
              >
                <title>{`${d.label}: ${formatIDR(d.spend)}`}</title>
              </circle>
              {i % labelStep === 0 && (
                <text
                  x={xAt(i, series.length)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* 2. Impressions and Clicks by Date */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Impressions and Clicks by Date</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-sky-700" /> Impressions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-red-700" /> Clicks
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.top + PLOT_H * (1 - t);
            return (
              <g key={t}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {formatCompactNumber(maxImp * t)}
                </text>
                <text x={W - PAD.right + 6} y={y + 3} className="fill-slate-400 text-[10px]">
                  {Math.round(maxClk * t)}
                </text>
              </g>
            );
          })}
          <polyline
            fill="none"
            stroke="#0369a1"
            strokeWidth="2"
            points={polylinePoints(impressions, maxImp)}
          />
          <polyline
            fill="none"
            stroke="#b91c1c"
            strokeWidth="2"
            points={polylinePoints(clicks, maxClk)}
          />
          {series.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={d.date}
                x={xAt(i, series.length)}
                y={H - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      {/* 3. Impressions and CTR over time */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Impressions and CTR over time</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sky-700" /> Impressions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-amber-500" /> CTR
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.top + PLOT_H * (1 - t);
            return (
              <g key={t}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {formatCompactNumber(maxImp * t)}
                </text>
                <text x={W - PAD.right + 6} y={y + 3} className="fill-slate-400 text-[10px]">
                  {(maxCtr * t).toFixed(1)}%
                </text>
              </g>
            );
          })}
          {series.map((d, i) => {
            const x = xAt(i, series.length) - barWidth / 2;
            const y = yAt(d.impressions, maxImp);
            const h = PAD.top + PLOT_H - y;
            return (
              <rect
                key={d.date}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, h)}
                rx="2"
                fill="#0e7490"
              >
                <title>{`${d.label}: ${d.impressions.toLocaleString("id-ID")} impr · CTR ${d.ctr.toFixed(2)}%`}</title>
              </rect>
            );
          })}
          <polyline
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            points={polylinePoints(ctrs, maxCtr)}
          />
          {series.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={d.date}
                x={xAt(i, series.length)}
                y={H - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      {/* 4. Clicks and performance over time */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Clicks and performance over time</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-700" /> Clicks
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-slate-400" /> CPC
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.top + PLOT_H * (1 - t);
            return (
              <g key={t}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {Math.round(maxClk * t)}
                </text>
                <text x={W - PAD.right + 6} y={y + 3} className="fill-slate-400 text-[10px]">
                  {formatCompactNumber(maxCpc * t)}
                </text>
              </g>
            );
          })}
          {series.map((d, i) => {
            const clk = d.linkClicks || d.clicks;
            const x = xAt(i, series.length) - barWidth / 2;
            const y = yAt(clk, maxClk);
            const h = PAD.top + PLOT_H - y;
            return (
              <rect
                key={d.date}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, h)}
                rx="2"
                fill="#b91c1c"
              >
                <title>{`${d.label}: ${clk} klik · CPC ${formatIDR(d.cpc)}`}</title>
              </rect>
            );
          })}
          <polyline
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            points={polylinePoints(cpcs, maxCpc)}
          />
          {series.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={d.date}
                x={xAt(i, series.length)}
                y={H - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>
    </div>
  );
}

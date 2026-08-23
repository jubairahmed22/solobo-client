"use client";

import * as React from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";

import { Skeleton } from "@/components/admin/Skeleton";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

/**
 * Shared building blocks for the admin analytics dashboard pages. Kept local
 * to app/admin/analytics so the storefront bundle never pulls them in.
 * Flowbite palette, matching the admin dashboard: white shadow-sm cards on
 * gray-200 borders, gray-900/gray-500 text, #1A56DB data marks.
 */

/* Flowbite primary blue - same accent as the dashboard sales chart. */
const FLOWBITE_BLUE = "#1A56DB";

export const RANGE_WINDOWS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
] as const;

export function formatPct(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function formatNum(n: number): string {
  return n.toLocaleString();
}

export function formatMoney(n: number, currency = "BDT"): string {
  return formatPrice(n, currency);
}

/* "" Page header with title + range toggle "" */

export function ReportHeader({
  title,
  description,
  days,
  onDays,
}: {
  title: string;
  description?: string;
  days: number;
  onDays: (d: number) => void;
}) {
  return (
    <header className="flex flex-col gap-[16px] sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-[4px]">
        <h1 className="text-[24px] font-bold leading-tight text-gray-900">{title}</h1>
        {description ? <p className="text-[14px] text-gray-500">{description}</p> : null}
      </div>
      {/* Same segmented toggle as the dashboard sales chart */}
      <div className="inline-flex shrink-0 overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm">
        {RANGE_WINDOWS.map((w) => (
          <button
            key={w.days}
            type="button"
            onClick={() => onDays(w.days)}
            className={cn(
              "border-l border-gray-200 px-[12px] py-[6px] text-[13px] font-medium transition duration-75 first:border-l-0",
              days === w.days
                ? "bg-gray-100 text-gray-900"
                : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900",
            )}
            aria-pressed={days === w.days}
          >
            {w.label}
          </button>
        ))}
      </div>
    </header>
  );
}

/* "" Section panel "" */

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm",
        className,
      )}
    >
      {title || action ? (
        <div className="flex items-center justify-between gap-1">
          {title ? (
            <h2 className="text-[16px] font-bold leading-tight text-gray-900">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* "" KPI stat card "" */

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className="flex flex-col rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <span
        className={cn(
          "text-[24px] font-bold leading-none tabular-nums",
          tone === "good"
            ? "text-green-600"
            : tone === "warn"
              ? "text-yellow-700"
              : "text-gray-900",
        )}
      >
        {value}
      </span>
      <span className="mt-[8px] text-[14px] font-normal text-gray-500">{label}</span>
      {sub ? <span className="mt-[4px] text-[13px] text-gray-500">{sub}</span> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

/* "" Loading / error / empty wrapper "" */

export function ReportState({
  isLoading,
  isError,
  isEmpty,
  emptyHint,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  emptyHint?: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-[10px] py-[8px]" role="status" aria-label="Loading" aria-busy>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-[12px]">
            <Skeleton className="h-[12px] flex-1" />
            <Skeleton className="h-[12px] w-[56px] shrink-0" />
          </div>
        ))}
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[32px] text-center">
        <AlertTriangle className="h-[20px] w-[20px] text-gray-400" aria-hidden />
        <p className="text-[14px] font-medium text-gray-600">Couldn&apos;t load this report</p>
        <p className="text-[12px] text-gray-400">Check that the API is reachable and try again.</p>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[32px] text-center">
        <BarChart3 className="h-[20px] w-[20px] text-gray-300" aria-hidden />
        <p className="text-[14px] font-medium text-gray-600">No data in this window yet</p>
        {emptyHint ? <p className="text-[12px] text-gray-400">{emptyHint}</p> : null}
      </div>
    );
  }
  return <>{children}</>;
}

/* "" Horizontal bar list (ranked breakdowns) "" */

export interface BarRow {
  label: string;
  sub?: string;
  value: number;
  display: string;
}

export function BarList({ rows, empty = "No data" }: { rows: BarRow[]; empty?: string }) {
  if (rows.length === 0) {
    return <p className="py-2 text-center text-sm text-neutral-500">{empty}</p>;
  }
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <ul className="flex flex-col gap-[12px]">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="flex flex-col gap-[4px]">
          <div className="flex items-baseline justify-between gap-1 text-[14px]">
            <span className="truncate font-medium text-gray-900">
              {r.label}
              {r.sub ? <span className="ml-0.5 font-normal text-gray-400">· {r.sub}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-gray-500">{r.display}</span>
          </div>
          {/* Flowbite progress bar - same as the dashboard top-sellers list */}
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                backgroundColor: FLOWBITE_BLUE,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* "" Funnel chart (vertical stack of shrinking bars) "" */

export function FunnelChart({
  steps,
}: {
  steps: Array<{ label: string; sessions: number; rateFromTop: number; rateFromPrev: number }>;
}) {
  if (steps.length === 0 || (steps[0]?.sessions ?? 0) === 0) {
    return (
      <p className="py-4 text-center text-sm text-neutral-500">
        No funnel activity in this window yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col gap-[4px]">
          <div className="flex items-baseline justify-between gap-1 text-[14px]">
            <span className="font-medium text-gray-900">{s.label}</span>
            <span className="tabular-nums text-gray-500">
              {formatNum(s.sessions)}
              <span className="ml-1 text-[12px] text-gray-400">
                {formatPct(s.rateFromTop)} of top
                {i > 0 ? ` · ${formatPct(s.rateFromPrev)} step` : ""}
              </span>
            </span>
          </div>
          <div className="h-[16px] w-full overflow-hidden rounded-[4px] bg-gray-200">
            <div
              className="flex h-full items-center rounded-[4px]"
              style={{
                width: `${Math.max(3, s.rateFromTop)}%`,
                backgroundColor: FLOWBITE_BLUE,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* "" Minimal table "" */

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function MiniTable<T>({
  columns,
  rows,
  empty = "No rows",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey: (row: T, i: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="py-2 text-center text-sm text-neutral-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
            {columns.map((c, i) => (
              <th
                key={i}
                className={cn("py-1 pr-2 font-medium", c.align === "right" && "text-right", c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={rowKey(row, ri)} className="border-b border-neutral-100 last:border-0">
              {columns.map((c, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "py-1 pr-2 align-top",
                    c.align === "right" && "text-right tabular-nums",
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* "" Simple SVG trend (sparkline-ish area) for a single numeric series "" */

export function TrendChart({
  points,
  height = 120,
  label,
}: {
  points: Array<{ date: string; value: number }>;
  height?: number;
  label?: string;
}) {
  const n = points.length;
  if (n === 0) {
    return <p className="py-4 text-center text-sm text-neutral-500">No data</p>;
  }
  const max = points.reduce((m, p) => Math.max(m, p.value), 0) || 1;
  const w = 600;
  const pad = 4;
  const innerH = height - pad * 2;
  const step = n > 1 ? w / (n - 1) : 0;
  const coords = points.map((p, i) => {
    const x = n > 1 ? i * step : w / 2;
    const y = pad + innerH - (p.value / max) * innerH;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const firstX = coords[0]?.[0] ?? 0;
  const lastX = coords[n - 1]?.[0] ?? w;
  const baseline = (height - pad).toFixed(1);
  const area = `${line} L${lastX.toFixed(1)},${baseline} L${firstX.toFixed(1)},${baseline} Z`;

  return (
    <div className="flex flex-col gap-0.5">
      {label ? <span className="text-xs text-neutral-500">{label}</span> : null}
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={label ?? "Trend"}
      >
        <path d={area} fill={FLOWBITE_BLUE} fillOpacity={0.12} />
        <path d={line} fill="none" stroke={FLOWBITE_BLUE} strokeWidth={2} />
      </svg>
    </div>
  );
}


"use client";

import * as React from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

/**
 * Shared building blocks for the admin analytics dashboard pages. Kept local
 * to app/admin/analytics so the storefront bundle never pulls them in. All
 * monochrome, on the 8px grid, matching the rest of the admin surface.
 */

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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-neutral-600">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center rounded-sm border border-neutral-200 bg-neutral-50 p-1">
        {RANGE_WINDOWS.map((w) => (
          <button
            key={w.days}
            type="button"
            onClick={() => onDays(w.days)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              days === w.days ? "bg-ink text-paper" : "text-neutral-600 hover:bg-neutral-100",
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
    <section className={cn("flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-4", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-1">
          {title ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : <span />}
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
    <div className="flex flex-col gap-1 rounded-sm border border-neutral-200 bg-paper p-4">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span
        className={cn(
          "text-3xl font-bold tabular-nums tracking-tight text-ink",
          tone === "good" && "text-ink",
          tone === "warn" && "text-ink",
        )}
      >
        {value}
      </span>
      {sub ? <span className="text-xs text-neutral-400">{sub}</span> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
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
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-neutral-200 py-8 text-center">
        <AlertTriangle className="h-5 w-5 text-neutral-400" aria-hidden />
        <p className="text-sm font-medium">Couldn&apos;t load this report</p>
        <p className="text-xs text-neutral-500">Check that the API is reachable and try again.</p>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-neutral-200 py-8 text-center">
        <BarChart3 className="h-5 w-5 text-neutral-400" aria-hidden />
        <p className="text-sm font-medium">No data in this window yet</p>
        {emptyHint ? <p className="text-xs text-neutral-500">{emptyHint}</p> : null}
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
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-1 text-sm">
            <span className="truncate">
              {r.label}
              {r.sub ? <span className="ml-0.5 text-neutral-400">· {r.sub}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{r.display}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
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
        <li key={s.label} className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-1 text-sm">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums text-neutral-600">
              {formatNum(s.sessions)}
              <span className="ml-1 text-xs text-neutral-400">
                {formatPct(s.rateFromTop)} of top
                {i > 0 ? ` · ${formatPct(s.rateFromPrev)} step` : ""}
              </span>
            </span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-sm bg-neutral-100">
            <div
              className="flex h-full items-center rounded-sm bg-accent"
              style={{ width: `${Math.max(3, s.rateFromTop)}%` }}
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
        <path d={area} fill="currentColor" className="text-neutral-100" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-accent" />
      </svg>
    </div>
  );
}



"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui";
import { Skeleton } from "@/components/admin/Skeleton";
import { SalesChartSvg } from "@/components/composed/SalesChartSvg";
import { useAdminTimeseries } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { cn } from "@/lib/utils/cn";

/**
 * Admin sales analytics chart — Phase 28.
 *
 * Thin wrapper around the shared {@link SalesChartSvg} renderer. Aggregates
 * across every seller's slice (no per-seller filter) so the admin sees the
 * platform-wide pulse. Owns the data fetch (via `useAdminTimeseries`), the
 * 7d/30d/90d window toggle, the totals header, and the loading/error/empty
 * states. The SVG itself is shared with the seller chart so axis math +
 * render details don't drift between the two surfaces.
 */

interface AdminSalesChartProps {
  /** Override the initial window (defaults to 30). */
  initialDays?: 7 | 30 | 90;
  /**
   * Optional drill-down into a single seller's slice. Echoed to the
   * backend's `?sellerId=` query param. Useful for admin troubleshooting;
   * `AdminDashboardClient` doesn't currently surface this control, but
   * adjacent pages (e.g. a seller detail view) can render the chart
   * pre-scoped.
   */
  sellerId?: string;
}

const WINDOWS: ReadonlyArray<{ days: 7 | 30 | 90; label: string }> = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function formatMoney(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

function WindowToggle({
  current,
  onChange,
  disabled,
}: {
  current: number;
  onChange: (days: 7 | 30 | 90) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Time window"
      className="inline-flex overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm"
    >
      {WINDOWS.map((w) => {
        const active = current === w.days;
        return (
          <button
            key={w.days}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(w.days)}
            className={cn(
              "border-l border-gray-200 px-[12px] py-[6px] text-[13px] font-medium transition duration-75 first:border-l-0",
              active
                ? "bg-gray-100 text-gray-900"
                : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminSalesChart({
  initialDays = 30,
  sellerId,
}: AdminSalesChartProps) {
  const [days, setDays] = React.useState<7 | 30 | 90>(initialDays);
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminTimeseries(days, sellerId);

  const series = data?.series ?? [];
  const totals = data?.totals;
  const currency = data?.currency ?? "BDT";
  // Densified series — never zero-length once the fetch succeeds. We treat
  // the chart as empty when there were no orders across the whole window.
  const isEmpty = (totals?.orderCount ?? 0) === 0;

  return (
    <section>
      {/* Flowbite chart-card header - hero number, muted context line,
          window toggle on the right. */}
      <header className="flex flex-wrap items-start justify-between gap-[16px] pb-[16px]">
        <div className="min-w-0">
          {totals ? (
            <p className="text-[24px] font-bold leading-none tabular-nums text-gray-900">
              {formatMoney(totals.revenue, currency)}
            </p>
          ) : (
            <h2 className="text-[24px] font-bold leading-none text-gray-900">
              {sellerId ? "Seller sales" : "Platform sales"}
            </h2>
          )}
          <p className="mt-[8px] text-[14px] font-normal text-gray-500">
            {sellerId ? "Seller sales" : "Sales"} in the last {days} days
          </p>
          {totals && (
            <p className="mt-[4px] text-[13px] tabular-nums text-gray-500">
              {totals.orderCount.toLocaleString("en-US")}{" "}
              {totals.orderCount === 1 ? "order" : "orders"}
              <span className="mx-[4px] text-gray-400">·</span>
              {totals.unitCount.toLocaleString("en-US")}{" "}
              {totals.unitCount === 1 ? "unit" : "units"}
            </p>
          )}
        </div>
        <WindowToggle current={days} onChange={setDays} disabled={isLoading} />
      </header>

      {isLoading ? (
        <div className="mt-[16px] flex h-48 items-end gap-[6px]" role="status" aria-label="Loading chart" aria-busy>
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${30 + ((i * 37) % 65)}%` }} />
          ))}
          <span className="sr-only">Loading chart</span>
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 py-[32px] text-center">
          <AlertTriangle className="h-[20px] w-[20px] text-gray-400" aria-hidden />
          <p className="text-[14px] text-gray-500">
            {error instanceof AdminError
              ? error.message
              : "Couldn't load the sales chart."}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 py-[32px] text-center">
          <BarChart3 className="h-[20px] w-[20px] text-gray-300" aria-hidden />
          <p className="text-[14px] font-medium text-gray-600">
            No sales in this window yet.
          </p>
          <p className="max-w-sm text-[12px] text-gray-400">
            {sellerId
              ? "This seller hasn't had any non-cancelled orders in the selected window."
              : "Once orders start landing across the platform, they'll show up here. Try widening the window."}
          </p>
        </div>
      ) : (
        <div className={cn(isFetching && "opacity-70 transition-opacity")}>
          <SalesChartSvg series={series} windowDays={days} />
        </div>
      )}

      {/* Flowbite chart-card footer - report link behind a top border */}
      <div className="mt-[16px] flex items-center justify-end border-t border-gray-200 pt-[8px]">
        <Link
          href="/admin/analytics/financial"
          className="inline-flex items-center gap-[8px] rounded-[8px] px-[12px] py-[8px] text-[12px] font-semibold uppercase tracking-wide text-[#1A56DB] transition duration-75 hover:bg-gray-100"
        >
          Sales report
          <ArrowRight className="h-[16px] w-[16px]" aria-hidden />
        </Link>
      </div>
    </section>
  );
}


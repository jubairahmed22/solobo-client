"use client";

import * as React from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
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
      className="inline-flex overflow-hidden rounded-sm border border-neutral-200 bg-paper"
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
              "px-1.5 py-0.5 text-xs font-medium transition-colors",
              active
                ? "bg-ink text-paper"
                : "text-neutral-700 hover:bg-neutral-100",
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
      <header className="flex flex-wrap items-end justify-between gap-2 pb-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-ink">
            {sellerId ? "Seller sales" : "Platform sales"}
          </h2>
          {totals ? (
            <p className="text-xs text-neutral-600">
              <span className="tabular-nums text-ink">
                {formatMoney(totals.revenue, currency)}
              </span>
              <span className="mx-0.5 text-neutral-400">·</span>
              <span className="tabular-nums">
                {totals.orderCount.toLocaleString("en-US")}{" "}
                {totals.orderCount === 1 ? "order" : "orders"}
              </span>
              <span className="mx-0.5 text-neutral-400">·</span>
              <span className="tabular-nums">
                {totals.unitCount.toLocaleString("en-US")}{" "}
                {totals.unitCount === 1 ? "unit" : "units"}
              </span>
              <span className="ml-0.5 text-neutral-500">
                {" "}
                in the last {days} days
              </span>
            </p>
          ) : (
            <p className="text-xs text-neutral-500">
              Daily revenue and order count across the platform.
            </p>
          )}
        </div>
        <WindowToggle current={days} onChange={setDays} disabled={isLoading} />
      </header>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 py-8 text-center">
          <AlertTriangle className="h-5 w-5 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-600">
            {error instanceof AdminError
              ? error.message
              : "Couldn't load the sales chart."}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 py-8 text-center">
          <BarChart3 className="h-5 w-5 text-neutral-200" aria-hidden />
          <p className="text-sm font-medium text-neutral-600">
            No sales in this window yet.
          </p>
          <p className="max-w-sm text-xs text-neutral-400">
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
    </section>
  );
}


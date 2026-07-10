"use client";

import * as React from "react";

/**
 * Shared, presentational SVG line+bar chart for daily sales analytics.
 *
 * Renders a self-contained SVG (no recharts) with order-count bars and a
 * revenue line overlay. Used by both `SellerSalesChart` (one seller's slice
 * of activity) and `AdminSalesChart` (platform-wide aggregate) - the series
 * shape is identical on both surfaces, so the same renderer drives both.
 *
 * The component is purely visual - it takes a densified series (one bucket
 * per day in the window, zero-filled by the server) and `windowDays`, and
 * lets the caller own the data fetch, header, totals, and empty/loading
 * states. Keeps the SVG render testable in isolation and avoids two copies
 * of the same axis math drifting out of sync.
 */

/**
 * Densified per-day bucket. `date` is YYYY-MM-DD in the server's timezone.
 * Both the seller and admin endpoints produce this shape - we re-declare
 * it loosely here so the chart doesn't have to import from a specific
 * caller's types module.
 */
export interface SalesChartPoint {
  date: string;
  revenue: number;
  orderCount: number;
  unitCount?: number;
}

interface SalesChartSvgProps {
  series: SalesChartPoint[];
  /** Used to switch X-axis tick labels (weekday on 7d, month/day on 30d/90d). */
  windowDays: number;
}

/**
 * Compact money for axis ticks - k / M suffixes so the y-axis stays readable
 * when revenue grows. Currency code is dropped on ticks; the chart caller's
 * totals header carries the full label.
 *
 * Exported so wrappers can use the same compact format on hover cards or
 * companion KPIs without duplicating the rounding rules.
 */
export function formatMoneyShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}k`;
  return amount.toLocaleString("en-US");
}

/**
 * Parse `YYYY-MM-DD` into a local Date without the UTC roll-back that
 * `new Date("2026-01-15")` causes in negative-offset timezones. We want
 * the bucket label to match the server's BDT day, not the user's locale.
 */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function formatTickLabel(ymd: string, windowDays: number): string {
  const d = parseLocalDate(ymd);
  if (windowDays <= 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Pick "nice" axis-friendly ticks for a given max value - rounds up to the
 * next 1/2/5 * 10^n so the top of the axis isn't a weird `1837.4`.
 */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / pow;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

export function SalesChartSvg({ series, windowDays }: SalesChartSvgProps) {
  // Virtual canvas - scales responsively via `viewBox`. Coordinates are in
  // "px" but the actual rendered size is driven by the container width.
  const W = 800;
  const H = 240;
  const mLeft = 44;
  const mRight = 16;
  const mTop = 12;
  const mBottom = 28;
  const plotW = W - mLeft - mRight;
  const plotH = H - mTop - mBottom;

  const n = series.length;
  const maxRevenueRaw = series.reduce((acc, p) => Math.max(acc, p.revenue), 0);
  const maxOrdersRaw = series.reduce((acc, p) => Math.max(acc, p.orderCount), 0);
  const maxRevenue = niceCeil(maxRevenueRaw || 1);
  const maxOrders = niceCeil(maxOrdersRaw || 1);

  // X position for each bucket - bars are centred in their slot, the line
  // walks through the same centres so they align.
  const slotWidth = n > 0 ? plotW / n : plotW;
  const xCentre = (i: number) => mLeft + (i + 0.5) * slotWidth;
  const yRevenue = (rev: number) =>
    mTop + plotH - (rev / maxRevenue) * plotH;
  const yOrders = (count: number) =>
    mTop + plotH - (count / maxOrders) * plotH;

  // Line path. We draw straight segments between centres rather than a smooth
  // spline - straight is more honest about gap days that show 0.
  const linePath = series
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xCentre(i).toFixed(2)},${yRevenue(p.revenue).toFixed(2)}`,
    )
    .join(" ");

  // Area beneath the line - same path, then drop to baseline and close.
  const areaPath =
    n > 0
      ? `${linePath} L${xCentre(n - 1).toFixed(2)},${(mTop + plotH).toFixed(2)} L${xCentre(0).toFixed(2)},${(mTop + plotH).toFixed(2)} Z`
      : "";

  // Pick X-axis ticks - at most 7, evenly spaced including first + last.
  const tickCount = Math.min(7, n);
  const tickIndices: number[] = [];
  if (tickCount > 0) {
    if (tickCount === 1) tickIndices.push(0);
    else {
      for (let i = 0; i < tickCount; i++) {
        tickIndices.push(Math.round((i * (n - 1)) / (tickCount - 1)));
      }
    }
  }

  // Y-axis ticks for revenue - 5 evenly spaced lines (0, 25%, 50%, 75%, 100%).
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: maxRevenue * f,
    y: mTop + plotH - f * plotH,
  }));

  const barWidth = Math.max(2, slotWidth * 0.55);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Daily sales over the last ${windowDays} days`}
      className="h-48 w-full sm:h-56"
    >
      {/* Y gridlines + tick labels */}
      {yTicks.map((t, i) => (
        <g key={`y-${i}`}>
          <line
            x1={mLeft}
            x2={W - mRight}
            y1={t.y}
            y2={t.y}
            className="stroke-neutral-200"
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : "2 3"}
          />
          <text
            x={mLeft - 6}
            y={t.y + 3}
            textAnchor="end"
            className="fill-neutral-500"
            style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
          >
            {formatMoneyShort(t.value)}
          </text>
        </g>
      ))}

      {/* Bars - order count */}
      {series.map((p, i) => {
        if (p.orderCount === 0) return null;
        const top = yOrders(p.orderCount);
        const height = mTop + plotH - top;
        return (
          <rect
            key={`bar-${p.date}`}
            x={xCentre(i) - barWidth / 2}
            y={top}
            width={barWidth}
            height={Math.max(1, height)}
            className="fill-neutral-200"
          >
            <title>{`${p.date} · ${p.orderCount} ${p.orderCount === 1 ? "order" : "orders"}`}</title>
          </rect>
        );
      })}

      {/* Revenue area + line */}
      {n > 0 && (
        <>
          <path d={areaPath} className="fill-ink/5" />
          <path
            d={linePath}
            className="stroke-ink"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Revenue dots - only on days with any revenue, keeps zero-days quiet */}
      {series.map((p, i) =>
        p.revenue > 0 ? (
          <circle
            key={`dot-${p.date}`}
            cx={xCentre(i)}
            cy={yRevenue(p.revenue)}
            r={2}
            className="fill-ink"
          >
            <title>{`${p.date} · revenue ${formatMoneyShort(p.revenue)}`}</title>
          </circle>
        ) : null,
      )}

      {/* X-axis tick labels */}
      {tickIndices.map((i) => (
        <text
          key={`x-${i}`}
          x={xCentre(i)}
          y={H - 10}
          textAnchor="middle"
          className="fill-neutral-500"
          style={{ fontSize: 10 }}
        >
          {formatTickLabel(series[i]?.date ?? "", windowDays)}
        </text>
      ))}

      {/* Plot baseline */}
      <line
        x1={mLeft}
        x2={W - mRight}
        y1={mTop + plotH}
        y2={mTop + plotH}
        className="stroke-ink"
        strokeWidth={1}
      />
    </svg>
  );
}

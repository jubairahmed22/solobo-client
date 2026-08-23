import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Admin skeleton loaders - Flowbite-shaped placeholders that mirror the real
 * layout of each surface (table rows, mobile cards, stat tiles, forms) so the
 * page doesn't reflow when data lands.
 *
 * Every page in the admin shares these instead of a bare centred spinner: the
 * skeleton keeps the same card chrome (white / gray-200 / rounded-8 /
 * shadow-sm), the same Flowbite table header band, and the same column count,
 * so the loading state reads as "this content is arriving" rather than "the
 * page is blank".
 *
 * All bars use `animate-pulse` on gray-200, which the global
 * prefers-reduced-motion rule already neutralises for motion-sensitive users.
 */

/** Base shimmer bar. Compose with width/height utilities. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("animate-pulse rounded bg-gray-200", className)} style={style} aria-hidden />
  );
}

/** Wraps a skeleton block with the right a11y semantics. */
function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} aria-busy className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* ───────────────────── Cards ───────────────────── */

/** Generic Flowbite card shell with pulsing lines inside. */
export function AdminCardSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm", className)}>
      <Skeleton className="h-[18px] w-[140px]" />
      <div className="mt-[16px] flex flex-col gap-[10px]">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-[12px]", i === lines - 1 ? "w-[60%]" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/** Dashboard KPI tiles - hero number, label, delta, round icon chip. */
export function AdminStatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRegion
      label="Loading stats"
      className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="h-[24px] w-[70%]" />
            <Skeleton className="mt-[10px] h-[12px] w-[50%]" />
            <Skeleton className="mt-[10px] h-[12px] w-[60%]" />
          </div>
          <Skeleton className="h-[40px] w-[40px] rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Sales / analytics chart card - header figure, toggle, plot area. */
export function AdminChartSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonRegion
      label="Loading chart"
      className={cn("rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-[16px]">
        <div>
          <Skeleton className="h-[24px] w-[120px]" />
          <Skeleton className="mt-[8px] h-[12px] w-[160px]" />
        </div>
        <Skeleton className="h-[32px] w-[160px] rounded-[8px]" />
      </div>
      {/* Plot area - staggered bars read as a chart rather than a grey slab */}
      <div className="mt-[24px] flex h-[180px] items-end gap-[6px]">
        {Array.from({ length: 24 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            // Deterministic pseudo-random heights - no hydration mismatch.
            style={{ height: `${30 + ((i * 37) % 65)}%` }}
          />
        ))}
      </div>
    </SkeletonRegion>
  );
}

/* ───────────────────── Lists ───────────────────── */

interface ListSkeletonProps {
  /** Number of placeholder rows. */
  rows?: number;
  /** Text columns in the desktop table (excluding thumb / checkbox / action). */
  columns?: number;
  /** Leading square thumbnail or avatar. */
  withThumb?: boolean;
  /** Round the thumb (users/avatars) instead of squaring it (products). */
  roundThumb?: boolean;
  /** Leading bulk-select checkbox column. */
  withCheckbox?: boolean;
}

/** Desktop table skeleton - Flowbite header band + divided rows. */
function TableSkeleton({
  rows = 8,
  columns = 3,
  withThumb = true,
  roundThumb = false,
  withCheckbox = false,
}: ListSkeletonProps) {
  return (
    <div className="hidden overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:block">
      {/* Header band */}
      <div className="flex items-center gap-[16px] border-b border-gray-200 bg-gray-50 px-[16px] py-[12px]">
        {withCheckbox ? <Skeleton className="h-[16px] w-[16px] shrink-0" /> : null}
        <Skeleton className="h-[10px] w-[80px] shrink-0" />
        {Array.from({ length: columns - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-[10px] w-[64px] shrink-0" />
        ))}
        <span className="flex-1" />
        <Skeleton className="h-[10px] w-[48px] shrink-0" />
      </div>
      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-[16px] px-[16px] py-[12px]">
            {withCheckbox ? <Skeleton className="h-[16px] w-[16px] shrink-0" /> : null}
            {/* Primary cell - thumb + two lines */}
            <div className="flex min-w-0 flex-[2] items-center gap-[12px]">
              {withThumb ? (
                <Skeleton className={cn("h-[40px] w-[40px] shrink-0", roundThumb && "rounded-full")} />
              ) : null}
              <div className="min-w-0 flex-1">
                <Skeleton className="h-[13px] w-[70%]" />
                <Skeleton className="mt-[6px] h-[11px] w-[45%]" />
              </div>
            </div>
            {/* Remaining columns */}
            {Array.from({ length: columns - 1 }).map((_, c) => (
              <div key={c} className="min-w-0 flex-1">
                <Skeleton className="h-[12px] w-[70%]" />
              </div>
            ))}
            {/* Action */}
            <Skeleton className="h-[24px] w-[56px] shrink-0 rounded-[6px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mobile card-list skeleton - matches the native-app row layout. */
function CardListSkeleton({
  rows = 6,
  withThumb = true,
  roundThumb = false,
}: ListSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:hidden">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-[12px] px-[16px] py-[12px]">
            {withThumb ? (
              <Skeleton className={cn("h-[44px] w-[44px] shrink-0", roundThumb && "rounded-full")} />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-[8px]">
                <Skeleton className="h-[13px] w-[55%]" />
                <Skeleton className="h-[13px] w-[56px] shrink-0" />
              </div>
              <Skeleton className="mt-[6px] h-[11px] w-[70%]" />
              <div className="mt-[8px] flex gap-[6px]">
                <Skeleton className="h-[16px] w-[52px] rounded-[4px]" />
                <Skeleton className="h-[16px] w-[64px] rounded-[4px]" />
              </div>
            </div>
            <Skeleton className="h-[16px] w-[16px] shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The list skeleton every admin index page uses: mobile cards below `md`,
 * the full table from `md` up - exactly how the real results render.
 */
export function AdminListSkeleton(props: ListSkeletonProps) {
  return (
    <SkeletonRegion label="Loading results">
      <CardListSkeleton {...props} />
      <TableSkeleton {...props} />
    </SkeletonRegion>
  );
}

/** Category tree skeleton - indented rows instead of a flat table. */
export function AdminTreeSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonRegion
      label="Loading categories"
      className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-[16px] border-b border-gray-200 bg-gray-50 px-[16px] py-[12px]">
        <Skeleton className="h-[10px] w-[80px]" />
        <span className="flex-1" />
        <Skeleton className="h-[10px] w-[48px]" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-[8px] py-[10px] pr-[16px]"
            // Alternate indent depth so it reads as a tree.
            style={{ paddingLeft: `${8 + (i % 3) * 20}px` }}
          >
            <Skeleton className="h-[16px] w-[16px] shrink-0" />
            <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-[6px]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-[13px] w-[40%]" />
              <Skeleton className="mt-[6px] h-[10px] w-[25%]" />
            </div>
            <Skeleton className="hidden h-[16px] w-[56px] rounded-[4px] sm:block" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Product-card grid skeleton - POS catalog & barcode browse. */
export function AdminProductGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion
      label="Loading products"
      className={cn("grid grid-cols-2 gap-[16px] sm:grid-cols-3 lg:grid-cols-4", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[8px] border border-gray-200 bg-white p-[12px] shadow-sm">
          <Skeleton className="aspect-square w-full rounded-[8px]" />
          <Skeleton className="mt-[12px] h-[13px] w-[85%]" />
          <Skeleton className="mt-[8px] h-[13px] w-[45%]" />
          <Skeleton className="mt-[12px] h-[36px] w-full rounded-[8px]" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/* ───────────────────── Forms & detail ───────────────────── */

/** One form section card - heading + field rows. */
export function AdminFormSectionSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <Skeleton className="h-[18px] w-[120px]" />
      <div className="mt-[16px] grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className={cn(i === 0 && "sm:col-span-2")}>
            <Skeleton className="h-[12px] w-[80px]" />
            <Skeleton className="mt-[8px] h-[40px] w-full rounded-[8px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Edit-form page skeleton: header (back link, title, actions) plus the
 * main-column / sidebar grid every admin form uses.
 */
export function AdminFormSkeleton({
  sections = 3,
  sidebarCards = 2,
}: {
  sections?: number;
  sidebarCards?: number;
}) {
  return (
    <SkeletonRegion label="Loading form" className="flex flex-col gap-[16px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <Skeleton className="h-[14px] w-[110px]" />
          <Skeleton className="mt-[8px] h-[24px] w-[220px]" />
          <Skeleton className="mt-[8px] h-[12px] w-[160px]" />
        </div>
        <div className="flex gap-[8px]">
          <Skeleton className="h-[40px] w-[104px] rounded-[8px]" />
          <Skeleton className="h-[40px] w-[96px] rounded-[8px]" />
          <Skeleton className="h-[40px] w-[128px] rounded-[8px]" />
        </div>
      </div>
      {/* Body */}
      <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-[16px]">
          {Array.from({ length: sections }).map((_, i) => (
            <AdminFormSectionSkeleton key={i} fields={i === 0 ? 3 : 2} />
          ))}
        </div>
        <div className="flex flex-col gap-[16px]">
          {Array.from({ length: sidebarCards }).map((_, i) => (
            <AdminCardSkeleton key={i} lines={2} />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * Whole-dashboard skeleton: greeting, KPI row, sales chart, then the
 * recent-orders / top-products split - the exact shape of the real page.
 */
export function AdminDashboardSkeleton() {
  return (
    <SkeletonRegion label="Loading dashboard" className="flex flex-col gap-[16px]">
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <Skeleton className="h-[24px] w-[240px]" />
          <Skeleton className="mt-[8px] h-[13px] w-[280px]" />
          <Skeleton className="mt-[6px] h-[12px] w-[200px]" />
        </div>
        <Skeleton className="h-[40px] w-[200px] rounded-[8px]" />
      </div>
      <AdminStatCardsSkeleton />
      <AdminChartSkeleton />
      {/* Quick actions */}
      <div>
        <Skeleton className="mb-[8px] h-[16px] w-[110px]" />
        <div className="flex flex-wrap gap-[8px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[40px] w-[132px] rounded-[8px]" />
          ))}
        </div>
      </div>
      {/* Recent orders + top products */}
      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[1fr_320px]">
        <AdminCardSkeleton lines={6} />
        <AdminCardSkeleton lines={4} />
      </div>
    </SkeletonRegion>
  );
}

/**
 * Detail-page skeleton (order / user): header with title + action buttons,
 * then the `[1fr_320px]` main-column / sidebar split. The main column leads
 * with a line-item list, since that's the dominant block on both pages.
 */
export function AdminDetailSkeleton({
  lineItems = 3,
  sidebarCards = 3,
}: {
  lineItems?: number;
  sidebarCards?: number;
}) {
  return (
    <SkeletonRegion label="Loading details" className="flex flex-col gap-[16px]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <Skeleton className="h-[14px] w-[100px]" />
          <Skeleton className="mt-[8px] h-[24px] w-[200px]" />
          <div className="mt-[8px] flex gap-[6px]">
            <Skeleton className="h-[18px] w-[64px] rounded-[4px]" />
            <Skeleton className="h-[18px] w-[56px] rounded-[4px]" />
          </div>
        </div>
        <div className="flex gap-[8px]">
          <Skeleton className="h-[40px] w-[104px] rounded-[8px]" />
          <Skeleton className="h-[40px] w-[120px] rounded-[8px]" />
        </div>
      </div>
      {/* Body */}
      <div className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-[16px]">
          {/* Line items */}
          <div className="rounded-[8px] border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-[16px]">
              <Skeleton className="h-[18px] w-[100px]" />
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from({ length: lineItems }).map((_, i) => (
                <div key={i} className="flex items-center gap-[12px] p-[16px]">
                  <Skeleton className="h-[56px] w-[56px] shrink-0 rounded-[6px]" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-[13px] w-[60%]" />
                    <Skeleton className="mt-[6px] h-[11px] w-[35%]" />
                  </div>
                  <Skeleton className="h-[13px] w-[64px] shrink-0" />
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="flex flex-col gap-[8px] border-t border-gray-200 p-[16px]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-[12px] w-[80px]" />
                  <Skeleton className="h-[12px] w-[64px]" />
                </div>
              ))}
            </div>
          </div>
          <AdminCardSkeleton lines={3} />
        </div>
        <div className="flex flex-col gap-[16px]">
          {Array.from({ length: sidebarCards }).map((_, i) => (
            <AdminCardSkeleton key={i} lines={i === 0 ? 4 : 2} />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * Small nested panels (variant pickers, product lookups, search results)
 * that sit inside an existing card and only need a few lines.
 */
export function AdminInlineSkeleton({
  rows = 3,
  withThumb = false,
  className,
}: {
  rows?: number;
  withThumb?: boolean;
  className?: string;
}) {
  return (
    <SkeletonRegion label="Loading" className={cn("flex flex-col gap-[8px]", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-[10px]">
          {withThumb ? <Skeleton className="h-[32px] w-[32px] shrink-0 rounded-[6px]" /> : null}
          <Skeleton className="h-[12px] flex-1" />
          <Skeleton className="h-[12px] w-[48px] shrink-0" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Printable invoice document skeleton - masthead, parties, table, totals. */
export function AdminInvoiceSkeleton() {
  return (
    <SkeletonRegion
      label="Loading invoice"
      className="mx-auto flex max-w-3xl flex-col gap-[24px] rounded-[8px] border border-gray-200 bg-white p-[24px] shadow-sm"
    >
      {/* Masthead */}
      <div className="flex items-start justify-between gap-[16px]">
        <div>
          <Skeleton className="h-[24px] w-[140px]" />
          <Skeleton className="mt-[8px] h-[12px] w-[180px]" />
        </div>
        <div className="text-right">
          <Skeleton className="ml-auto h-[16px] w-[120px]" />
          <Skeleton className="ml-auto mt-[8px] h-[12px] w-[96px]" />
        </div>
      </div>
      {/* Bill to / ship to */}
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-[12px] w-[64px]" />
            <Skeleton className="mt-[8px] h-[12px] w-[85%]" />
            <Skeleton className="mt-[6px] h-[12px] w-[70%]" />
            <Skeleton className="mt-[6px] h-[12px] w-[55%]" />
          </div>
        ))}
      </div>
      {/* Line items */}
      <div>
        <div className="flex gap-[16px] border-b border-gray-200 pb-[8px]">
          <Skeleton className="h-[10px] flex-[3]" />
          <Skeleton className="h-[10px] flex-1" />
          <Skeleton className="h-[10px] flex-1" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-[16px] border-b border-gray-100 py-[12px]">
            <Skeleton className="h-[12px] flex-[3]" />
            <Skeleton className="h-[12px] flex-1" />
            <Skeleton className="h-[12px] flex-1" />
          </div>
        ))}
      </div>
      {/* Totals */}
      <div className="ml-auto flex w-full max-w-[240px] flex-col gap-[8px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-[12px] w-[72px]" />
            <Skeleton className="h-[12px] w-[56px]" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Toolbar skeleton - search field + filter selects inside a card. */
export function AdminToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
      <div className="flex flex-1 items-center gap-[8px]">
        <Skeleton className="h-[40px] flex-1 rounded-[8px] lg:max-w-[420px]" />
        <Skeleton className="h-[40px] w-[80px] shrink-0 rounded-[8px]" />
      </div>
      <div className="flex gap-[12px] lg:ml-auto">
        <Skeleton className="h-[40px] w-[140px] rounded-[8px]" />
        <Skeleton className="h-[40px] w-[140px] rounded-[8px]" />
      </div>
    </div>
  );
}

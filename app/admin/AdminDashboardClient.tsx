"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  MessageSquare,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useAdminStats } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { AdminSalesChart } from "./AdminSalesChart";
import { cn } from "@/lib/utils/cn";
import type { AdminRecentOrder, AdminTopProduct } from "@/types/admin";

/* ─────────────── Formatters ─────────────── */

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─────────────── KPI tile ─────────────── */

interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  subDelta?: string;
  Icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  href?: string;
  tone?: "default" | "warn" | "good";
}

function KpiTile({
  label,
  value,
  delta,
  subDelta,
  Icon,
  iconBg,
  iconColor,
  href,
  tone = "default",
}: KpiTileProps) {
  const body = (
    <div
      className={cn(
        "group flex flex-col gap-2.5 rounded-sm border bg-paper p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150",
        tone === "warn"
          ? "border-amber-100 bg-amber-50/60"
          : tone === "good"
            ? "border-emerald-100 bg-emerald-50/40"
            : "border-neutral-200 hover:border-neutral-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.09)]",
        href && "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-sm",
            iconBg ??
              (tone === "warn"
                ? "bg-amber-100"
                : tone === "good"
                  ? "bg-emerald-100"
                  : "bg-neutral-100 group-hover:bg-neutral-200"),
            iconColor ??
              (tone === "warn"
                ? "text-amber-600"
                : tone === "good"
                  ? "text-emerald-600"
                  : "text-neutral-500"),
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        {href && (
          <ArrowUpRight
            className="h-3.5 w-3.5 text-neutral-300 transition-colors group-hover:text-neutral-500"
            aria-hidden
          />
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {label}
        </p>
        <p className="mt-1 text-[26px] font-bold tabular-nums leading-tight text-ink">
          {value}
        </p>
        {delta && (
          <p
            className={cn(
              "mt-1.5 text-[11.5px]",
              tone === "warn" ? "text-amber-600" : "text-neutral-400",
            )}
          >
            {delta}
          </p>
        )}
        {subDelta && (
          <p className="mt-0.5 text-[11.5px] font-medium text-amber-600">
            {subDelta}
          </p>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="contents">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ─────────────── Alert banner ─────────────── */

function AlertBanner({
  pendingFulfilment,
  pendingReviews,
}: {
  pendingFulfilment: number;
  pendingReviews: number;
}) {
  if (pendingFulfilment === 0 && pendingReviews === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pendingFulfilment > 0 && (
        <Link
          href="/admin/orders?status=confirmed"
          className="inline-flex items-center gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
        >
          <Truck className="h-3 w-3" aria-hidden />
          {pendingFulfilment} order{pendingFulfilment !== 1 ? "s" : ""} awaiting
          fulfilment
        </Link>
      )}
      {pendingReviews > 0 && (
        <Link
          href="/admin/reviews?status=pending"
          className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 bg-paper px-2.5 py-1 text-[12px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <MessageSquare className="h-3 w-3" aria-hidden />
          {pendingReviews} review{pendingReviews !== 1 ? "s" : ""} pending
        </Link>
      )}
    </div>
  );
}

/* ─────────────── Recent orders table ─────────────── */

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-neutral-100 text-neutral-600",
  confirmed: "bg-blue-50 text-blue-700",
  packed:    "bg-violet-50 text-violet-700",
  shipped:   "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-500",
  returned:  "bg-neutral-100 text-neutral-500",
};

function RecentOrdersTable({ orders }: { orders: AdminRecentOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-sm border border-dashed border-neutral-200 py-10 text-center">
        <ShoppingBag className="h-6 w-6 text-neutral-200" aria-hidden />
        <p className="text-[12.5px] text-neutral-400">No orders yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50">
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Order
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Customer
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Total
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Status
            </th>
            <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400 md:table-cell">
              Placed
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {orders.map((o) => (
            <tr key={o._id} className="transition-colors hover:bg-neutral-50">
              <td className="px-3 py-2.5">
                <Link
                  href={`/admin/orders/${o._id}`}
                  className="font-mono text-[12px] font-semibold text-ink underline-offset-2 hover:text-accent hover:underline"
                >
                  {o.orderNumber}
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <p className="text-[13px] font-medium text-ink">
                  {o.user?.name ?? "-"}
                </p>
                {o.user?.email && (
                  <p className="text-[11px] text-neutral-400">{o.user.email}</p>
                )}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-[13px] font-semibold text-ink">
                {formatMoney(o.total, o.currency)}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                    STATUS_STYLES[o.status] ?? "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {o.status}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-[11.5px] text-neutral-400 md:table-cell">
                {formatDate(o.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────── Top products ─────────────── */

function TopProducts({ products }: { products: AdminTopProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-sm border border-dashed border-neutral-200 py-10 text-center">
        <Package className="h-6 w-6 text-neutral-200" aria-hidden />
        <p className="text-[12.5px] text-neutral-400">No sales yet.</p>
      </div>
    );
  }
  const max = products[0]?.units ?? 1;
  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-sm border border-neutral-200 bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      {products.map((p, rank) => {
        const pct = (p.units / Math.max(1, max)) * 100;
        return (
          <li key={p.productId} className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-neutral-300">
              {rank + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ink">
                {p.title}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 tabular-nums text-[11.5px] font-semibold text-neutral-500">
              {p.units} {p.units === 1 ? "unit" : "units"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ─────────────── Quick actions ─────────────── */

function QuickActions() {
  const actions = [
    {
      href: "/admin/products/new",
      label: "New product",
      Icon: Package,
      iconBg: "bg-neutral-900",
      iconColor: "text-accent",
    },
    {
      href: "/admin/orders?status=pending",
      label: "Pending orders",
      Icon: ShoppingBag,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      href: "/admin/reviews?status=pending",
      label: "Pending reviews",
      Icon: MessageSquare,
      iconBg: "bg-neutral-100",
      iconColor: "text-neutral-600",
    },
    {
      href: "/admin/coupons/new",
      label: "New coupon",
      Icon: TrendingUp,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {actions.map(({ href, label, Icon, iconBg, iconColor }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-2.5 rounded-sm border border-neutral-200 bg-paper px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-150 hover:border-neutral-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
        >
          <span
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-transform duration-150 group-hover:scale-105",
              iconBg,
              iconColor,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="min-w-0 truncate text-[12.5px] font-medium text-neutral-700">
            {label}
          </span>
          <ArrowRight
            className="ml-auto h-3 w-3 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}

/* ─────────────── Section header ─────────────── */

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-neutral-400">
        {title}
      </p>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-neutral-400 transition-colors hover:text-ink"
        >
          {linkLabel}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/* ─────────────── Main dashboard ─────────────── */

export function AdminDashboardClient() {
  const { data: session } = useSession();
  const { data, isLoading, isError, error, refetch } = useAdminStats();

  const firstName = (session?.user?.name ?? "").split(" ")[0] || "there";

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    const message =
      error instanceof AdminError
        ? error.message
        : "Couldn't load dashboard stats.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-[13.5px] text-neutral-500">{message}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const pendingReviews = data.reviews.pending;
  const pendingFulfilment = data.orders.pendingFulfilment;

  return (
    <div className="flex flex-col gap-4">

      {/* Greeting */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-tight text-ink">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-[13.5px] text-neutral-500">
            Here's what's happening with your store today.
          </p>
          <time className="mt-0.5 block text-[12px] text-neutral-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
        <AlertBanner
          pendingFulfilment={pendingFulfilment}
          pendingReviews={pendingReviews}
        />
      </header>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Total revenue"
          value={formatMoney(data.revenue.total, data.revenue.currency)}
          delta={`${formatMoney(data.revenue.recent, data.revenue.currency)} last 30 days`}
          Icon={BadgeDollarSign}
          iconBg="bg-red-50"
          iconColor="text-accent"
        />
        <KpiTile
          label="Orders"
          value={data.orders.total.toLocaleString("en-US")}
          delta={`${data.orders.recent} new this month`}
          subDelta={
            pendingFulfilment > 0
              ? `${pendingFulfilment} awaiting fulfilment`
              : undefined
          }
          Icon={ShoppingBag}
          href="/admin/orders"
          tone={pendingFulfilment > 0 ? "warn" : "default"}
          iconBg={pendingFulfilment > 0 ? undefined : "bg-neutral-100"}
          iconColor={pendingFulfilment > 0 ? undefined : "text-neutral-500"}
        />
        <KpiTile
          label="Customers"
          value={data.users.total.toLocaleString("en-US")}
          delta={`+${data.users.recent} this month`}
          Icon={Users}
          href="/admin/users"
          iconBg="bg-ink"
          iconColor="text-accent"
        />
        <KpiTile
          label="Active products"
          value={data.products.active.toLocaleString("en-US")}
          delta={`of ${data.products.total} total`}
          Icon={Boxes}
          href="/admin/products"
          iconBg="bg-neutral-100"
          iconColor="text-neutral-500"
        />
      </section>

      {/* Quick actions */}
      <section className="flex flex-col gap-2">
        <SectionHeader title="Quick actions" />
        <QuickActions />
      </section>

      {/* Sales chart */}
      <section className="rounded-sm border border-neutral-200 bg-paper p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <AdminSalesChart />
      </section>

      {/* Recent orders + top products */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Recent orders"
            href="/admin/orders"
            linkLabel="View all"
          />
          <RecentOrdersTable orders={data.recentOrders} />
        </div>

        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Top sellers"
            href="/admin/products"
            linkLabel="All products"
          />
          <TopProducts products={data.topProducts} />
        </div>
      </section>
    </div>
  );
}

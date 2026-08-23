"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
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
import { Button } from "@/components/ui";
import { AdminDashboardSkeleton } from "@/components/admin/Skeleton";
import { useAdminStats } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { AdminSalesChart } from "./AdminSalesChart";
import { cn } from "@/lib/utils/cn";
import type { AdminRecentOrder, AdminTopProduct } from "@/types/admin";

/* Flowbite primary blue - matches the sales chart line and link accents. */
const FLOWBITE_BLUE = "#1A56DB";

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

/* ─────────────── Flowbite card shell ─────────────── */

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Flowbite card header - bold title left, blue "View all" link right. */
function CardHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-[16px] p-[16px]">
      <div className="min-w-0">
        <h2 className="text-[18px] font-bold leading-tight text-gray-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-[2px] text-[13px] font-normal text-gray-500">
            {subtitle}
          </p>
        )}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 rounded-[8px] px-[8px] py-[6px] text-[14px] font-medium text-[#1A56DB] transition duration-75 hover:bg-gray-100 hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/* ─────────────── KPI tile ───────────────
 * Flowbite stat widget: hero number top-left, muted label under it, delta
 * line with a trend arrow, round icon chip on the right.
 */

interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "neutral" | "warn";
  subDelta?: string;
  Icon: LucideIcon;
  href?: string;
}

function KpiTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  subDelta,
  Icon,
  href,
}: KpiTileProps) {
  const body = (
    <div
      className={cn(
        "flex h-full items-start justify-between gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm transition duration-150",
        href && "cursor-pointer hover:bg-gray-50",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[24px] font-bold leading-none tabular-nums text-gray-900">
          {value}
        </p>
        <p className="mt-[8px] truncate text-[14px] font-normal text-gray-500">
          {label}
        </p>
        {delta && (
          <p
            className={cn(
              "mt-[8px] flex items-center gap-[4px] text-[13px] font-medium",
              deltaTone === "up"
                ? "text-green-600"
                : deltaTone === "warn"
                  ? "text-yellow-700"
                  : "text-gray-500",
            )}
          >
            {deltaTone === "up" && (
              <TrendingUp className="h-[14px] w-[14px] shrink-0" aria-hidden />
            )}
            <span className="truncate">{delta}</span>
          </p>
        )}
        {subDelta && (
          <p className="mt-[4px] truncate text-[13px] font-medium text-yellow-700">
            {subDelta}
          </p>
        )}
      </div>
      <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Icon className="h-[20px] w-[20px]" aria-hidden />
      </span>
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
    <div className="flex flex-wrap items-center gap-[8px]">
      {pendingFulfilment > 0 && (
        <Link
          href="/admin/orders?status=confirmed"
          className="inline-flex items-center gap-[6px] rounded-[6px] bg-yellow-100 px-[10px] py-[4px] text-[12px] font-medium text-yellow-800 transition duration-75 hover:bg-yellow-200"
        >
          <Truck className="h-[14px] w-[14px]" aria-hidden />
          {pendingFulfilment} order{pendingFulfilment !== 1 ? "s" : ""} awaiting
          fulfilment
        </Link>
      )}
      {pendingReviews > 0 && (
        <Link
          href="/admin/reviews?status=pending"
          className="inline-flex items-center gap-[6px] rounded-[6px] bg-gray-100 px-[10px] py-[4px] text-[12px] font-medium text-gray-800 transition duration-75 hover:bg-gray-200"
        >
          <MessageSquare className="h-[14px] w-[14px]" aria-hidden />
          {pendingReviews} review{pendingReviews !== 1 ? "s" : ""} pending
        </Link>
      )}
    </div>
  );
}

/* ─────────────── Recent orders card ─────────────── */

/* Flowbite badge recipe: bg-*-100 text-*-800, text-xs font-medium, rounded. */
const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-800",
  confirmed: "bg-blue-100 text-blue-800",
  packed:    "bg-purple-100 text-purple-800",
  shipped:   "bg-yellow-100 text-yellow-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned:  "bg-gray-100 text-gray-800",
};

function RecentOrdersCard({ orders }: { orders: AdminRecentOrder[] }) {
  return (
    <Card>
      <CardHeader
        title="Recent orders"
        subtitle="Latest orders across the store"
        href="/admin/orders"
        linkLabel="View all"
      />
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] px-[16px] pb-[32px] pt-[16px] text-center">
          <ShoppingBag className="h-[24px] w-[24px] text-gray-300" aria-hidden />
          <p className="text-[13px] text-gray-500">No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] text-gray-500">
            <thead className="bg-gray-50 text-[12px] uppercase text-gray-500">
              <tr>
                <th scope="col" className="px-[16px] py-[12px] font-medium">
                  Order
                </th>
                <th scope="col" className="px-[16px] py-[12px] font-medium">
                  Customer
                </th>
                <th scope="col" className="px-[16px] py-[12px] font-medium">
                  Total
                </th>
                <th scope="col" className="px-[16px] py-[12px] font-medium">
                  Status
                </th>
                <th
                  scope="col"
                  className="hidden px-[16px] py-[12px] font-medium md:table-cell"
                >
                  Placed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o._id} className="bg-white transition duration-75 hover:bg-gray-50">
                  <td className="px-[16px] py-[12px]">
                    <Link
                      href={`/admin/orders/${o._id}`}
                      className="font-semibold text-gray-900 hover:text-[#1A56DB] hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-[16px] py-[12px]">
                    <p className="font-medium text-gray-900">
                      {o.user?.name ?? "-"}
                    </p>
                    {o.user?.email && (
                      <p className="text-[12px] text-gray-500">{o.user.email}</p>
                    )}
                  </td>
                  <td className="px-[16px] py-[12px] font-semibold tabular-nums text-gray-900">
                    {formatMoney(o.total, o.currency)}
                  </td>
                  <td className="px-[16px] py-[12px]">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium capitalize",
                        STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-800",
                      )}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="hidden px-[16px] py-[12px] text-[13px] text-gray-500 md:table-cell">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ─────────────── Top products card ─────────────── */

function TopProductsCard({ products }: { products: AdminTopProduct[] }) {
  const max = products[0]?.units ?? 1;
  return (
    <Card>
      <CardHeader
        title="Top sellers"
        subtitle="Best-selling products by units"
        href="/admin/products"
        linkLabel="All products"
      />
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] px-[16px] pb-[32px] pt-[16px] text-center">
          <Package className="h-[24px] w-[24px] text-gray-300" aria-hidden />
          <p className="text-[13px] text-gray-500">No sales yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 px-[16px] pb-[8px]">
          {products.map((p, rank) => {
            const pct = (p.units / Math.max(1, max)) * 100;
            return (
              <li key={p.productId} className="flex items-center gap-[12px] py-[12px]">
                <span className="w-[20px] shrink-0 text-center text-[13px] font-semibold tabular-nums text-gray-400">
                  {rank + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-gray-900">
                    {p.title}
                  </p>
                  {/* Flowbite progress bar */}
                  <div className="mt-[6px] h-[6px] overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: FLOWBITE_BLUE }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-gray-500">
                  {p.units} {p.units === 1 ? "unit" : "units"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────── Quick actions ─────────────── */

function QuickActions() {
  const actions = [
    { href: "/admin/products/new", label: "New product", Icon: Package },
    { href: "/admin/orders?status=pending", label: "Pending orders", Icon: ShoppingBag },
    { href: "/admin/reviews?status=pending", label: "Pending reviews", Icon: MessageSquare },
    { href: "/admin/coupons/new", label: "New coupon", Icon: TrendingUp },
  ];
  return (
    <div className="grid grid-cols-2 gap-[16px] sm:grid-cols-4">
      {actions.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[12px] shadow-sm transition duration-150 hover:bg-gray-50"
        >
          <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-gray-100 text-gray-500 transition duration-75 group-hover:text-gray-900">
            <Icon className="h-[20px] w-[20px]" aria-hidden />
          </span>
          <span className="min-w-0 truncate text-[14px] font-medium text-gray-900">
            {label}
          </span>
          <ArrowRight
            className="ml-auto h-[16px] w-[16px] shrink-0 text-gray-400 transition duration-75 group-hover:text-gray-900"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}

/* ─────────────── Main dashboard ─────────────── */

export function AdminDashboardClient() {
  const { data: session } = useSession();
  const { data, isLoading, isError, error, refetch } = useAdminStats();

  const firstName = (session?.user?.name ?? "").split(" ")[0] || "there";

  if (isLoading) {
    return <AdminDashboardSkeleton />;
  }

  if (isError || !data) {
    const message =
      error instanceof AdminError
        ? error.message
        : "Couldn't load dashboard stats.";
    return (
      <Card className="flex flex-col items-center gap-[12px] p-[40px] text-center">
        <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
        <p className="text-[14px] text-gray-500">{message}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const pendingReviews = data.reviews.pending;
  const pendingFulfilment = data.orders.pendingFulfilment;

  return (
    <div className="flex flex-col gap-[16px]">

      {/* Greeting */}
      <header className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-gray-900">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-[4px] text-[14px] text-gray-500">
            Here's what's happening with your store today.
          </p>
          <time className="mt-[2px] block text-[13px] text-gray-400">
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
      <section className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Gross revenue"
          value={formatMoney(data.revenue.total, data.revenue.currency)}
          delta={`${formatMoney(data.revenue.recent, data.revenue.currency)} last 30 days`}
          subDelta={`Delivery excluded · ${formatMoney(data.revenue.deliveryMarginRecent, data.revenue.currency)} delivery margin (30d)`}
          Icon={BadgeDollarSign}
          href="/admin/analytics/financial"
        />
        <KpiTile
          label="Orders"
          value={data.orders.total.toLocaleString("en-US")}
          delta={`${data.orders.recent} new this month`}
          deltaTone={data.orders.recent > 0 ? "up" : "neutral"}
          subDelta={
            pendingFulfilment > 0
              ? `${pendingFulfilment} awaiting fulfilment`
              : undefined
          }
          Icon={ShoppingBag}
          href="/admin/orders"
        />
        <KpiTile
          label="Customers"
          value={data.users.total.toLocaleString("en-US")}
          delta={`+${data.users.recent} this month`}
          deltaTone={data.users.recent > 0 ? "up" : "neutral"}
          Icon={Users}
          href="/admin/users"
        />
        <KpiTile
          label="Active products"
          value={data.products.active.toLocaleString("en-US")}
          delta={`of ${data.products.total} total`}
          Icon={Boxes}
          href="/admin/products"
        />
      </section>

      {/* Sales chart */}
      <Card className="p-[16px] md:p-[24px]">
        <AdminSalesChart />
      </Card>

      {/* Quick actions */}
      <section>
        <h2 className="mb-[8px] text-[16px] font-semibold text-gray-900">
          Quick actions
        </h2>
        <QuickActions />
      </section>

      {/* Recent orders + top products */}
      <section className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[1fr_320px]">
        <RecentOrdersCard orders={data.recentOrders} />
        <TopProductsCard products={data.topProducts} />
      </section>
    </div>
  );
}

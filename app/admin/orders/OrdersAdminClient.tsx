"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, Search, ShoppingBag, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { ExportCsvButton, Pagination, Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useAdminOrders } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminListOrdersParams, AdminOrderSort, AdminOrderSummary } from "@/types/admin";
import type { OrderStatus, PaymentStatus } from "@/types/commerce";

const STATUS_FILTERS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

const PAYMENT_OPTIONS: { value: PaymentStatus | ""; label: string }[] = [
  { value: "", label: "All payments" },
  { value: "pending", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const SORT_OPTIONS: { value: AdminOrderSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "total-desc", label: "Total: high → low" },
  { value: "total-asc", label: "Total: low → high" },
];

const STATUS_TONES: Record<string, string> = {
  pending:   "bg-neutral-100 text-neutral-700",
  confirmed: "bg-blue-50 text-blue-700",
  packed:    "bg-violet-50 text-violet-700",
  shipped:   "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-500",
  returned:  "bg-neutral-100 text-neutral-500",
};

const PAYMENT_TONES: Record<string, string> = {
  pending:  "bg-neutral-100 text-neutral-700",
  paid:     "bg-emerald-50 text-emerald-700",
  failed:   "bg-red-50 text-red-600",
  refunded: "bg-neutral-100 text-neutral-500",
};

function formatMoney(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch { return `${currency} ${amount.toLocaleString("en-US")}`; }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function OrderRow({ order }: { order: AdminOrderSummary }) {
  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-3 py-2.5 align-middle">
        <Link href={`/admin/orders/${order._id}`} className="font-mono text-sm font-semibold text-ink underline-offset-2 hover:underline">
          {order.orderNumber}
        </Link>
        <p className="text-xs text-neutral-500">
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}{order.shippingDistrict ? ` · ${order.shippingDistrict}` : ""}
        </p>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <p className="text-sm font-medium text-ink">{order.user?.name ?? "Guest"}</p>
        <p className="truncate text-xs text-neutral-500">{order.user?.email ?? order.email ?? "-"}</p>
      </td>
      <td className="px-3 py-2.5 align-middle tabular-nums text-sm font-semibold text-ink">
        {formatMoney(order.total, order.currency)}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className={cn("inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold capitalize", STATUS_TONES[order.status] ?? "bg-neutral-100 text-neutral-700")}>
          {order.status}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className={cn("inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold capitalize", PAYMENT_TONES[order.payment.status] ?? "bg-neutral-100 text-neutral-700")}>
          {order.payment.status}
        </span>
        <p className="mt-0.5 text-xs text-neutral-500">{order.payment.method}</p>
      </td>
      <td className="hidden px-3 py-2.5 align-middle text-xs text-neutral-400 md:table-cell">
        {formatDate(order.createdAt)}
      </td>
      <td className="px-3 py-2.5 align-middle text-right">
        <Link href={`/admin/orders/${order._id}`} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink">
          Manage <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

export function OrdersAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = (search.get("status") ?? "") as OrderStatus | "";
  const paymentStatus = (search.get("paymentStatus") ?? "") as PaymentStatus | "";
  const sort = (search.get("sort") ?? "newest") as AdminOrderSort;
  const qFromUrl = search.get("q") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => { setQDraft(qFromUrl); }, [qFromUrl]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k); else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmitSearch = (e: React.FormEvent) => { e.preventDefault(); update({ q: qDraft.trim() || undefined }); };

  const params: AdminListOrdersParams = React.useMemo(
    () => ({ status: status || undefined, paymentStatus: paymentStatus || undefined, sort, q: qFromUrl || undefined, page, limit: 20 }),
    [status, paymentStatus, sort, qFromUrl, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminOrders(params);
  const orders = data?.data.orders ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = Boolean(status) || Boolean(paymentStatus) || Boolean(qFromUrl) || sort !== "newest";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Orders</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Track fulfilment, update payment, and resolve cancellations.</p>
        </div>
        <div className="flex items-center gap-2">
          {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
          <ExportCsvButton
            path="/admin/orders/export.csv"
            params={{ status: status || undefined, paymentStatus: paymentStatus || undefined, sort, q: qFromUrl || undefined }}
            disabled={!meta || meta.total === 0}
          />
        </div>
      </header>

      {/* Status tabs */}
      <nav aria-label="Order status filter" className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const active = (status || "") === f.value;
          return (
            <button key={f.value || "all"} type="button" onClick={() => update({ status: f.value || undefined })}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-ink bg-ink text-paper" : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-ink")}
              aria-pressed={active}>
              {f.label}
            </button>
          );
        })}
      </nav>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Order #, name, email or phone" className="pl-8" />
          </div>
          <button type="submit" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Find</button>
        </form>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Payment</span>
          <Select value={paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value || undefined })} options={PAYMENT_OPTIONS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Sort</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value })} options={SORT_OPTIONS} />
        </div>
        {filtersActive ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink">
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          </>
        ) : null}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load orders."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <ShoppingBag className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">{filtersActive ? "No orders match these filters." : "No orders yet."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Order</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Customer</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Total</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Payment</th>
                <th className="hidden px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 md:table-cell">Placed</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((o) => <OrderRow key={o._id} order={o} />)}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}


"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  Package,
  Pencil,
  Search,
  ShoppingBag,
  User,
  Wallet,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ExportCsvButton, Pagination, Select } from "@/components/composed";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminListSkeleton, AdminInlineSkeleton } from "@/components/admin/Skeleton";
import { FloatingMenu } from "@/components/admin/FloatingMenu";
import { isCustomizationKey } from "@/components/admin/CustomizationEditor";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminOrder,
  useAdminOrders,
  useUpdateOrderPayment,
  useUpdateOrderStatus,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminListOrdersParams, AdminOrderSort, AdminOrderSummary } from "@/types/admin";
import type { Address, OrderStatus, PaymentStatus } from "@/types/commerce";

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

const SOURCE_OPTIONS: { value: "" | "web" | "pos"; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "web", label: "Website" },
  { value: "pos", label: "POS" },
];

const SORT_OPTIONS: { value: AdminOrderSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "total-desc", label: "Total: high → low" },
  { value: "total-asc", label: "Total: low → high" },
];

/**
 * Fulfilment status machine, mirrored from the backend's own
 * `ALLOWED_TRANSITIONS` (Server/src/controllers/order.controller.ts) so the
 * inline status menu only ever offers a target the server will actually
 * accept - never a dead-end that just bounces back with a 400.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

const PAYMENT_STATUS_CHOICES: { value: PaymentStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

/* Flowbite bg-*-100/text-*-800 palette - matches the order detail page and
 * the products page's Status column, so a badge means the same thing
 * everywhere in the admin. */
const STATUS_TONES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  confirmed: "bg-blue-100 text-blue-800",
  packed: "bg-purple-100 text-purple-800",
  shipped: "bg-yellow-100 text-yellow-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-gray-100 text-gray-800",
};

const PAYMENT_TONES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

function formatMoney(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch { return `${currency} ${amount.toLocaleString("en-US")}`; }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${datePart}, ${timePart}`;
  } catch { return iso; }
}

function joinAddress(addr: Address): string {
  return [addr.line1, addr.line2, addr.city, addr.district, addr.division]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(", ");
}

/**
 * Real "cash to collect on delivery" - this store keeps no partial-payment
 * ledger, so once `payment.status` flips to "paid" nothing further is owed.
 * Prefers the courier's own dispatch instruction (`courier.codAmount`,
 * which Pathao may have adjusted) when it's available, falling back to the
 * order total for undispatched/non-courier COD orders. Returns null for
 * non-COD orders (not applicable, not zero).
 */
function codAmountFor(
  order: { total: number; payment: { method: string; status: PaymentStatus } },
  courierCodAmount?: number,
): number | null {
  if (order.payment.method !== "cod") return null;
  if (order.payment.status === "paid") return 0;
  return courierCodAmount ?? order.total;
}

/** Size/color-style variant axes only - personalisation keys excluded. */
function variantOptionsLabel(options?: Record<string, string>): string | null {
  if (!options) return null;
  const parts = Object.entries(options)
    .filter(([k]) => !isCustomizationKey(k))
    .map(([, v]) => v);
  return parts.length > 0 ? parts.join(" / ") : null;
}

/** Personalisation keys only (Name/Number/Print/Patches) - "Customization: NA" when none. */
function formatCustomization(options?: Record<string, string>): string | null {
  if (!options) return null;
  const parts = Object.entries(options)
    .filter(([k]) => isCustomizationKey(k))
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/* ───────────────────── Inline status / payment change ───────────────────── */

function StatusBadgeMenu({ order }: { order: AdminOrderSummary }) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateOrderStatus(order._id);
  const targets = ALLOWED_STATUS_TRANSITIONS[order.status] ?? [];

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-[4px] rounded-[4px] px-[10px] py-[3px] text-[12px] font-semibold capitalize",
        STATUS_TONES[order.status] ?? "bg-gray-100 text-gray-800",
      )}
    >
      {update.isPending ? <Loader2 className="h-[11px] w-[11px] animate-spin" aria-hidden /> : null}
      {order.status}
    </span>
  );

  if (targets.length === 0) return badge;

  const onPick = async (next: OrderStatus) => {
    try {
      await update.mutateAsync({ status: next });
      toast({ title: `Order marked ${next}`, tone: "success" });
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't update status", tone: "error" });
    }
  };

  return (
    <FloatingMenu
      triggerClassName="inline-flex items-center rounded-[4px] transition duration-75 hover:opacity-80"
      triggerLabel={`Change status - currently ${order.status}`}
      menuWidth={176}
      disabled={update.isPending}
      items={targets.map((t) => ({ label: `Mark ${t}`, icon: ArrowRight, onClick: () => onPick(t) }))}
    >
      {badge}
    </FloatingMenu>
  );
}

function PaymentBadgeMenu({ order }: { order: AdminOrderSummary }) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateOrderPayment(order._id);
  const targets = PAYMENT_STATUS_CHOICES.filter((o) => o.value !== order.payment.status);

  const onPick = async (next: PaymentStatus) => {
    try {
      await update.mutateAsync({ status: next });
      toast({ title: `Payment marked ${next}`, tone: "success" });
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't update payment", tone: "error" });
    }
  };

  return (
    <FloatingMenu
      triggerClassName="inline-flex items-center rounded-[4px] transition duration-75 hover:opacity-80"
      triggerLabel={`Change payment status - currently ${order.payment.status}`}
      menuWidth={176}
      disabled={update.isPending}
      items={targets.map((t) => ({ label: t.label, icon: CreditCard, onClick: () => onPick(t.value) }))}
    >
      <span
        className={cn(
          "inline-flex items-center gap-[4px] rounded-[4px] px-[10px] py-[3px] text-[12px] font-semibold capitalize",
          PAYMENT_TONES[order.payment.status] ?? "bg-gray-100 text-gray-800",
        )}
      >
        {update.isPending ? <Loader2 className="h-[11px] w-[11px] animate-spin" aria-hidden /> : null}
        {order.payment.status}
      </span>
    </FloatingMenu>
  );
}

/** One-click shortcut for the single most common transition - only shown while pending. */
function ConfirmButton({ order }: { order: AdminOrderSummary }) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateOrderStatus(order._id);
  if (order.status !== "pending") return null;

  const onConfirm = async () => {
    try {
      await update.mutateAsync({ status: "confirmed" });
      toast({ title: "Order confirmed", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't confirm order", tone: "error" });
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onConfirm();
      }}
      disabled={update.isPending}
      className="inline-flex h-[32px] items-center gap-[6px] rounded-[8px] bg-[#1A56DB] px-[14px] text-[13px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {update.isPending ? (
        <Loader2 className="h-[13px] w-[13px] animate-spin" aria-hidden />
      ) : (
        <CheckCircle2 className="h-[13px] w-[13px]" aria-hidden />
      )}
      Confirm
    </button>
  );
}

/* ───────────────────── Expand panel (Product / Payment / Customer) ───────────────────── */

function OrderExpandPanel({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError } = useAdminOrder(orderId);

  if (isLoading) {
    return <AdminInlineSkeleton rows={6} />;
  }
  if (isError || !order) {
    return (
      <div className="flex items-center gap-[8px] text-[13px] text-red-600">
        <AlertTriangle className="h-[14px] w-[14px]" aria-hidden />
        Couldn&rsquo;t load this order&rsquo;s details.
      </div>
    );
  }

  const customerName = order.shippingAddress.fullName || order.user?.name || "Guest";
  const email = order.email || (order.channel !== "pos" ? order.user?.email : undefined);
  const cod = codAmountFor(order, order.courier?.codAmount);
  // Real breakdown only - no fabricated "advance payment" or "partially
  // paid" line (this store doesn't track partial payments); the discount
  // label reflects whichever real mechanism produced it.
  const discountLabel = order.couponCode
    ? `Coupon (${order.couponCode})`
    : order.orderDiscount
      ? "Manual discount"
      : "Discount";

  return (
    <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-3">
      {/* Product Details */}
      <section className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
        <h3 className="mb-[12px] flex items-center gap-[8px] text-[14px] font-semibold text-gray-900">
          <Package className="h-[16px] w-[16px] text-gray-400" aria-hidden /> Product Details
        </h3>
        <ul className="flex flex-col divide-y divide-gray-100">
          {order.items.map((item) => {
            const size = variantOptionsLabel(item.options);
            const custom = formatCustomization(item.options);
            return (
              <li key={item._id} className="flex gap-[10px] py-[10px] first:pt-0 last:pb-0">
                <div className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[6px] border border-gray-100 bg-gray-50">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-[8px]">
                    <p className="truncate text-[13px] font-semibold text-gray-900">{item.title}</p>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-900">
                      {formatMoney(item.lineTotal, order.currency)}
                    </span>
                  </div>
                  {size ? <p className="text-[12px] text-gray-500">{size}</p> : null}
                  <p className="text-[12px] text-gray-400">{item.qty} Pcs</p>
                  <p className="text-[12px] text-gray-400">Customization: {custom ?? "NA"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Payment Details */}
      <section className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
        <h3 className="mb-[12px] flex items-center gap-[8px] text-[14px] font-semibold text-gray-900">
          <Wallet className="h-[16px] w-[16px] text-gray-400" aria-hidden /> Payment Details
        </h3>
        <dl className="flex flex-col divide-y divide-gray-100 text-[13px]">
          <div className="flex items-center justify-between py-[8px]">
            <dt className="text-gray-500">
              Subtotal ({order.items.length} {order.items.length === 1 ? "Item" : "Items"})
            </dt>
            <dd className="font-medium tabular-nums text-gray-900">{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          <div className="flex items-center justify-between py-[8px]">
            <dt className="text-gray-500">Delivery Charge</dt>
            <dd className="font-medium tabular-nums text-gray-900">{formatMoney(order.shippingCost, order.currency)}</dd>
          </div>
          <div className="flex items-center justify-between py-[8px]">
            <dt className="font-semibold text-gray-900">Total Amount</dt>
            <dd className="font-semibold tabular-nums text-gray-900">{formatMoney(order.total, order.currency)}</dd>
          </div>
          {order.discount > 0 ? (
            <div className="flex items-center justify-between py-[8px]">
              <dt className="text-gray-500">{discountLabel}</dt>
              <dd className="font-medium tabular-nums text-red-600">-{formatMoney(order.discount, order.currency)}</dd>
            </div>
          ) : null}
          {cod !== null ? (
            <div className="flex items-center justify-between py-[8px]">
              <dt className="font-semibold text-gray-900">COD Amount</dt>
              <dd className="font-semibold tabular-nums text-gray-900">{formatMoney(cod, order.currency)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Customer Details */}
      <section className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
        <h3 className="mb-[12px] flex items-center gap-[8px] text-[14px] font-semibold text-gray-900">
          <User className="h-[16px] w-[16px] text-gray-400" aria-hidden /> Customer Details
        </h3>
        <dl className="flex flex-col divide-y divide-gray-100 text-[13px]">
          <div className="flex items-center justify-between py-[8px]">
            <dt className="text-gray-500">Customer Name</dt>
            <dd className="font-medium text-gray-900">{customerName}</dd>
          </div>
          <div className="flex items-start justify-between gap-[8px] py-[8px]">
            <dt className="shrink-0 text-gray-500">Address</dt>
            <dd className="text-right font-medium text-gray-900">{joinAddress(order.shippingAddress)}</dd>
          </div>
          <div className="flex items-center justify-between py-[8px]">
            <dt className="text-gray-500">Phone</dt>
            <dd className="font-medium text-gray-900">{order.shippingAddress.phone || "—"}</dd>
          </div>
          <div className="flex items-center justify-between py-[8px]">
            <dt className="text-gray-500">Mail</dt>
            <dd className="font-medium text-gray-900">{email || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/* ───────────────────── Desktop row ───────────────────── */

interface OrderRowProps {
  order: AdminOrderSummary;
  expanded: boolean;
  onToggleExpand: () => void;
}

function OrderRow({ order, expanded, onToggleExpand }: OrderRowProps) {
  /* The shipping snapshot is the source of truth for who the customer is -
   * for walk-in POS orders `order.user` is the cashier, never the buyer.
   * `order.email` is the customer's snapshot email (checkout input / walk-in
   * receipt email); the populated user email is only trustworthy for web
   * orders, where the account holder is the buyer. */
  const customerName = order.customerName || order.user?.name || "Guest";
  const customerEmail =
    order.email || (order.channel !== "pos" ? order.user?.email : undefined);
  const contact = [order.customerPhone, customerEmail].filter(Boolean).join(" · ");
  const cod = codAmountFor(order);

  return (
    <>
      <tr
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className={cn(
          "cursor-pointer bg-white transition duration-75 hover:bg-gray-50",
          expanded && "bg-blue-50/60 hover:bg-blue-50/60",
        )}
      >
        {/* Order */}
        <td className="px-3 py-3 align-top">
          <div className="flex items-center gap-[6px]">
            <ChevronRight
              className={cn(
                "h-[14px] w-[14px] shrink-0 text-gray-400 transition-transform duration-150",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
            <span className="font-mono text-sm font-semibold text-gray-900">{order.orderNumber}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-[4px] px-[8px] py-[2px] text-[11px] font-medium",
                order.channel === "pos" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800",
              )}
              title={order.channel === "pos" ? "In-person sale (POS)" : "Storefront order"}
            >
              {order.channel === "pos" ? "POS" : "Web"}
            </span>
          </div>
          <p className="mt-[2px] pl-[20px] text-xs text-gray-500">
            {formatMoney(order.total, order.currency)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            {order.shippingDistrict ? ` · ${order.shippingDistrict}` : ""}
          </p>
        </td>

        {/* Customer */}
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap items-center gap-[6px]">
            <p className="text-sm font-medium text-gray-900">{customerName}</p>
            {order.hasCustomization ? (
              <span className="inline-flex items-center rounded-[4px] bg-indigo-100 px-[8px] py-[2px] text-[11px] font-medium text-indigo-800">
                Customized Order
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-gray-500">{contact || "—"}</p>
        </td>

        {/* COD Amount - real cash-to-collect; "—" when not applicable (not COD). */}
        <td className="px-3 py-3 align-top text-right tabular-nums">
          {cod !== null ? (
            <span className={cn("text-sm font-semibold", cod > 0 ? "text-gray-900" : "text-gray-400")}>
              {formatMoney(cod, order.currency)}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
          <StatusBadgeMenu order={order} />
        </td>

        {/* Payment */}
        <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
          <PaymentBadgeMenu order={order} />
          <p className="mt-[3px] text-xs uppercase text-gray-400">{order.payment.method}</p>
        </td>

        {/* Placed */}
        <td className="hidden px-3 py-3 align-top text-xs text-gray-400 lg:table-cell">
          {formatDate(order.createdAt)}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-[6px]">
            <ConfirmButton order={order} />
            <Link
              href={`/admin/orders/${order._id}`}
              title="Open order"
              aria-label="Open order"
              className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] border border-gray-200 text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <Pencil className="h-[14px] w-[14px]" aria-hidden />
            </Link>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-3 py-4">
            <OrderExpandPanel orderId={order._id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * Mobile row - a native-app "grouped list" cell: whole row is a tap target,
 * disclosure chevron on the right, badges wrap onto their own line under
 * the customer contact. Mirrors the same data as the desktop table row -
 * it navigates to the detail page rather than expanding inline, since the
 * click-to-expand accordion is a desktop-table interaction.
 */
function OrderCardMobile({ order }: { order: AdminOrderSummary }) {
  const customerName = order.customerName || order.user?.name || "Guest";
  const customerEmail =
    order.email || (order.channel !== "pos" ? order.user?.email : undefined);
  const contact = [order.customerPhone, customerEmail].filter(Boolean).join(" · ");
  const cod = codAmountFor(order);
  return (
    <Link
      href={`/admin/orders/${order._id}`}
      className="flex items-center gap-[12px] px-[16px] py-[12px] active:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-[8px]">
          <div className="flex min-w-0 items-center gap-[6px]">
            <span className="truncate font-mono text-[14px] font-semibold text-gray-900">
              {order.orderNumber}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-[4px] px-[6px] py-[1px] text-[10px] font-medium",
                order.channel === "pos"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800",
              )}
            >
              {order.channel === "pos" ? "POS" : "Web"}
            </span>
          </div>
          <span className="shrink-0 text-[14px] font-bold tabular-nums text-gray-900">
            {formatMoney(order.total, order.currency)}
          </span>
        </div>
        <p className="mt-[2px] truncate text-[12px] text-gray-500">
          {customerName}
          {contact ? ` · ${contact}` : ""}
        </p>
        <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
          <span className={cn("inline-flex items-center rounded-[4px] px-[8px] py-[2px] text-[11px] font-semibold capitalize", STATUS_TONES[order.status] ?? "bg-gray-100 text-gray-800")}>
            {order.status}
          </span>
          <span className={cn("inline-flex items-center rounded-[4px] px-[8px] py-[2px] text-[11px] font-semibold capitalize", PAYMENT_TONES[order.payment.status] ?? "bg-gray-100 text-gray-800")}>
            {order.payment.status}
          </span>
          {order.hasCustomization ? (
            <span className="inline-flex items-center rounded-[4px] bg-indigo-100 px-[8px] py-[2px] text-[11px] font-medium text-indigo-800">
              Customized
            </span>
          ) : null}
          {cod !== null && cod > 0 ? (
            <span className="text-[11px] font-medium text-gray-500">COD {formatMoney(cod, order.currency)}</span>
          ) : null}
          <span className="text-[11px] text-gray-400">{formatDate(order.createdAt)}</span>
        </div>
      </div>
      <ChevronRight className="h-[16px] w-[16px] shrink-0 text-gray-300" aria-hidden />
    </Link>
  );
}

export function OrdersAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = (search.get("status") ?? "") as OrderStatus | "";
  const paymentStatus = (search.get("paymentStatus") ?? "") as PaymentStatus | "";
  const channel = (search.get("channel") ?? "") as "web" | "pos" | "";
  const sort = (search.get("sort") ?? "newest") as AdminOrderSort;
  const qFromUrl = search.get("q") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => { setQDraft(qFromUrl); }, [qFromUrl]);

  /* Which rows have their Product/Payment/Customer detail panel expanded. */
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    () => ({ status: status || undefined, paymentStatus: paymentStatus || undefined, channel: channel || undefined, sort, q: qFromUrl || undefined, page, limit: 20 }),
    [status, paymentStatus, channel, sort, qFromUrl, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminOrders(params);
  const orders = data?.data.orders ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = Boolean(status) || Boolean(paymentStatus) || Boolean(channel) || Boolean(qFromUrl) || sort !== "newest";

  return (
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-gray-900 sm:text-2xl">Orders</h1>
          <p className="mt-0.5 text-[13px] text-neutral-500 sm:text-sm">Track fulfilment, update payment, and resolve cancellations.</p>
        </div>
        <div className="flex items-center gap-2">
          {meta ? <span className="text-[13px] text-neutral-400 sm:text-sm">{meta.total.toLocaleString("en-US")} total</span> : null}
          <ExportCsvButton
            path="/admin/orders/export.csv"
            params={{ status: status || undefined, paymentStatus: paymentStatus || undefined, channel: channel || undefined, sort, q: qFromUrl || undefined }}
            disabled={!meta || meta.total === 0}
          />
        </div>
      </header>

      {/* Status tabs - Flowbite underline tabs */}
      <AdminTabs
        ariaLabel="Order status filter"
        items={STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        value={status || ""}
        onChange={(v) => update({ status: v || undefined })}
      />

      {/* Filter bar - Flowbite table toolbar: search + primary button on the
          left, labeled selects on the right, everything on a 40px control
          height inside one card. */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        <form onSubmit={onSubmitSearch} className="flex w-full min-w-0 flex-1 items-center gap-[8px]">
          <label htmlFor="orders-search" className="sr-only">
            Search orders
          </label>
          <div className="relative min-w-0 flex-1 lg:max-w-[480px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input
              id="orders-search"
              type="search"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Order #, name, email or phone"
              className="pl-[36px]"
            />
          </div>
          <button
            type="submit"
            className="h-[40px] shrink-0 rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            Find
          </button>
        </form>

        {/* Filter chips - horizontally scrollable on mobile (swipe like a
            native filter strip) instead of wrapping into a cramped block;
            wraps normally from lg where there's room. */}
        <div
          className="-mx-[16px] flex flex-nowrap items-center gap-[12px] overflow-x-auto px-[16px] pb-[2px] lg:mx-0 lg:ml-auto lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 lg:shrink-0 lg:justify-end [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex shrink-0 items-center gap-[8px]">
            <label htmlFor="orders-source" className="text-[13px] font-medium text-gray-500">
              Source
            </label>
            <Select
              id="orders-source"
              value={channel}
              onChange={(e) => update({ channel: e.target.value || undefined })}
              options={SOURCE_OPTIONS}
            />
          </div>
          <div className="flex shrink-0 items-center gap-[8px]">
            <label htmlFor="orders-payment" className="text-[13px] font-medium text-gray-500">
              Payment
            </label>
            <Select
              id="orders-payment"
              value={paymentStatus}
              onChange={(e) => update({ paymentStatus: e.target.value || undefined })}
              options={PAYMENT_OPTIONS}
            />
          </div>
          <div className="flex shrink-0 items-center gap-[8px]">
            <label htmlFor="orders-sort" className="text-[13px] font-medium text-gray-500">
              Sort
            </label>
            <Select
              id="orders-sort"
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              options={SORT_OPTIONS}
            />
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="inline-flex h-[40px] shrink-0 items-center gap-[6px] rounded-[8px] border border-gray-200 bg-white px-[12px] text-[13px] font-medium text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-[14px] w-[14px]" aria-hidden />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <AdminListSkeleton rows={8} columns={5} withThumb={false} />
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
        <>
          {/* Mobile - native-app grouped list, one tappable row per order */}
          <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-gray-100">
              {orders.map((o) => (
                <li key={o._id}>
                  <OrderCardMobile order={o} />
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop / tablet - full table. Click a row to expand its
              Product/Payment/Customer detail panel inline. */}
          <div className="hidden overflow-x-auto rounded-[8px] border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Order</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Customer</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">COD Amount</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Payment</th>
                  <th className="hidden px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 lg:table-cell">Placed</th>
                  <th className="px-3 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((o) => (
                  <OrderRow
                    key={o._id}
                    order={o}
                    expanded={expandedIds.has(o._id)}
                    onToggleExpand={() => toggleExpanded(o._id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}

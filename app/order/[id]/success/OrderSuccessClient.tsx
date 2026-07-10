"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Package } from "lucide-react";
import { Spinner } from "@/components/ui";
import { buttonVariants } from "@/components/ui/Button";
import { useOrder } from "@/hooks/useCommerce";
import { trackPurchase } from "@/lib/analytics";
import { formatPrice, formatDateTime } from "@/lib/utils/format";

export interface OrderSuccessClientProps {
  orderId: string;
}

export function OrderSuccessClient({ orderId }: OrderSuccessClientProps) {
  const { data: order, isLoading, isError } = useOrder(orderId);

  // Fire the purchase conversion exactly once per order. The success page can
  // be refreshed or revisited from order history, so we dedupe via a
  // sessionStorage flag keyed on the order id - re-counting a sale would skew
  // every revenue/attribution report downstream.
  React.useEffect(() => {
    if (!order) return;
    const key = `pm_purchase_tracked_${order._id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked - accept best-effort de-dupe */
    }
    trackPurchase({
      orderId: order._id,
      orderNumber: order.orderNumber,
      value: order.total,
      currency: order.currency,
      items: order.items.reduce((s, it) => s + it.qty, 0),
      coupon: order.couponCode ?? undefined,
    });
  }, [order]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mt-4 flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-paper py-8 text-center">
        <p className="text-base font-medium">We couldn&apos;t load your order</p>
        <p className="text-sm text-neutral-600">
          If you just placed it, sign in and check your{" "}
          <Link href="/account/orders" className="underline">orders</Link>.
        </p>
      </div>
    );
  }

  const a = order.shippingAddress;

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-3 py-6 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500 bg-green-50">
        <CheckCircle2 className="h-7 w-7 text-green-600" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Thank you for your order!</h1>
        <p className="text-sm text-neutral-700">
          Your order <span className="font-semibold">{order.orderNumber}</span> has been placed on{" "}
          {formatDateTime(order.createdAt)}.
        </p>
        <p className="text-sm text-neutral-600">
          We&apos;ve emailed a confirmation to {order.email ?? "your inbox"}. You&apos;ll get another
          update when it ships.
        </p>
      </div>

      <div className="mt-1 w-full rounded-xl border border-neutral-200 bg-paper p-4 text-left">
        <h2 className="text-base font-semibold text-ink">Order summary</h2>
        <ul className="mt-2 flex flex-col divide-y divide-neutral-100 text-sm">
          {order.items.map((it) => (
            <li key={it._id} className="flex justify-between py-2">
              <span className="line-clamp-1 pr-4">
                {it.title} <span className="text-neutral-500">× {it.qty}</span>
              </span>
              <span className="shrink-0">{formatPrice(it.lineTotal, order.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-col gap-1 border-t border-neutral-200 pt-2 text-sm">
          <Row label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
          <Row label="Shipping" value={formatPrice(order.shippingCost, order.currency)} />
          {order.discount > 0 ? (
            <Row label="Discount" value={`− ${formatPrice(order.discount, order.currency)}`} />
          ) : null}
          <Row
            label="Total"
            value={formatPrice(order.total, order.currency)}
            strong
          />
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold text-ink">Shipping to</h3>
            <p className="text-neutral-700">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.city}, {a.district}
              {a.postalCode ? ` ${a.postalCode}` : ""}
              <br />
              {a.phone}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold text-ink">Payment</h3>
            <p className="capitalize text-neutral-700">
              {order.payment.method.replace("_", " ")}
              <br />
              <span className="text-neutral-500">Status: {order.payment.status}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/account/orders/${order.orderNumber}`}
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          <Package className="h-4 w-4" />
          <span className="ml-1.5">Track this order</span>
        </Link>
        <Link
          href="/all-products"
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          Continue shopping
        </Link>
      </div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-neutral-200 pt-2 font-bold text-ink" : ""}`}>
      <span className={strong ? "" : "text-neutral-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

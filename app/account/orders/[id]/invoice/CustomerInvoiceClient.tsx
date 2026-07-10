"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import {
  OrderInvoice,
  type InvoiceItem,
  type InvoiceTotals,
} from "@/components/composed";
import { useOrder } from "@/hooks/useCommerce";

/**
 * Customer-side invoice. Reads via /api/orders/:id (auth-gated to the
 * order's owner) and projects the full order into the OrderInvoice shape.
 * Keeps the live-data hook here so deep-link refresh still works after the
 * underlying order updates (e.g. payment captured between placing and
 * printing).
 */
export function CustomerInvoiceClient({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError } = useOrder(orderId);

  // Trigger the browser's print dialog. We call this on the explicit button
  // press instead of `useEffect` autoprint - autoprint surprises users who
  // are landing here just to copy details, and silently triggers on every
  // re-render in dev mode.
  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (isError || !order) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 p-4 text-center">
        <AlertTriangle className="h-8 w-8 text-neutral-400" aria-hidden />
        <p className="text-sm text-neutral-700">
          We couldn&rsquo;t load this invoice. It may belong to a different
          account, or the order is no longer available.
        </p>
        <Link href="/account/orders">
          <Button variant="secondary">Back to my orders</Button>
        </Link>
      </div>
    );
  }

  const items: InvoiceItem[] = order.items.map((it) => ({
    title: it.title,
    slug: it.slug,
    sku: it.sku,
    options: it.options,
    qty: it.qty,
    price: it.price,
    originalPrice: it.originalPrice,
    lineTotal: it.lineTotal,
  }));

  const totals: InvoiceTotals = {
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    currency: order.currency,
  };

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-4 print:p-0">
      {/* Header bar - hidden when printing so the slip starts at the
          invoice's own letterhead. */}
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link
          href={`/account/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to order
        </Link>
        <Button onClick={handlePrint} variant="primary" size="sm">
          <Printer className="h-4 w-4" aria-hidden />
          <span className="ml-1.5">Print / save PDF</span>
        </Button>
      </div>

      <OrderInvoice
        tone="customer"
        orderNumber={order.orderNumber}
        placedAt={order.createdAt}
        deliveredAt={order.tracking?.deliveredAt}
        status={order.status}
        paymentStatus={order.payment.status}
        paymentMethod={order.payment.method}
        shippingAddress={order.shippingAddress}
        billingAddress={order.billingAddress}
        customer={{
          name: order.shippingAddress.fullName,
          email: order.email,
          phone: order.shippingAddress.phone,
        }}
        items={items}
        totals={totals}
        couponCode={order.couponCode}
        customerNote={order.customerNote}
        tracking={
          order.tracking
            ? {
                carrier: order.tracking.carrier,
                trackingNumber: order.tracking.trackingNumber,
              }
            : undefined
        }
      />
    </div>
  );
}

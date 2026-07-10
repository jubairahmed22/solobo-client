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
import { useAdminOrder } from "@/hooks/useAdmin";

/**
 * Admin invoice - every field on every line. The `internalNotes` block is
 * preserved here (the customer and seller views drop it). Items don't carry
 * a populated seller name out of /admin/orders/:id yet, so the seller
 * column on the invoice stays empty by design - adding it is a future lift
 * once the endpoint populates `items.seller`.
 */
export function AdminInvoiceClient({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError } = useAdminOrder(orderId);

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
      <div className="mx-auto flex max-w-md flex-col items-center gap-1 p-4 text-center">
        <AlertTriangle className="h-3 w-3 text-neutral-500" aria-hidden />
        <p className="text-sm text-neutral-700">
          We couldn&rsquo;t load this admin invoice.
        </p>
        <Link href="/admin/orders">
          <Button variant="secondary">Back to orders</Button>
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
    // `it.seller` is currently a raw ObjectId string. We don't surface ids
    // on a printed invoice - the column hides itself when no row has a
    // human-readable seller name.
    sellerName: undefined,
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
    <div className="mx-auto max-w-3xl p-2 print:p-0">
      <div className="mb-2 flex items-center justify-between gap-1 print:hidden">
        <Link
          href={`/admin/orders/${orderId}`}
          className="inline-flex items-center gap-0.5 text-sm text-neutral-600 hover:text-ink"
        >
          <ArrowLeft className="h-2 w-2" aria-hidden />
          Back to order
        </Link>
        <Button onClick={handlePrint} variant="primary" size="sm">
          <Printer className="h-2 w-2" aria-hidden />
          <span className="ml-0.5">Print / save PDF</span>
        </Button>
      </div>

      <OrderInvoice
        tone="admin"
        orderNumber={order.orderNumber}
        placedAt={order.createdAt}
        deliveredAt={order.tracking?.deliveredAt}
        status={order.status}
        paymentStatus={order.payment.status}
        paymentMethod={order.payment.method}
        shippingAddress={order.shippingAddress}
        billingAddress={order.billingAddress}
        customer={{
          name: order.user?.name ?? order.shippingAddress.fullName,
          email: order.user?.email ?? order.email,
          phone: order.user?.phone ?? order.shippingAddress.phone,
        }}
        items={items}
        totals={totals}
        couponCode={order.couponCode}
        customerNote={order.customerNote}
        internalNotes={order.internalNotes}
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

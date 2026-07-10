"use client";

import * as React from "react";
import type { Address, OrderStatus, PaymentStatus } from "@/types/commerce";
import { COMPANY } from "@/lib/entity/company";

/**
 * OrderInvoice - print-optimized invoice block.
 *
 * Deliberately a pure presentational component. The customer / seller /
 * admin invoice pages each pass their projection of the order through and
 * the component renders the same chrome - letterhead, bill-to, ship-to,
 * line items, totals, payment block, footer.
 *
 * Why this isn't a server-side PDF:
 * Server PDFs need pdfkit or puppeteer. The pdfkit route is OK but BD SMEs
 * mostly want to print delivery slips on a thermal/laser printer, in which
 * case a clean printable HTML page hits the same target without adding a
 * 200KB+ binary dependency. The browser's print dialog also offers
 * "Save as PDF" so customers who want a digital copy still get one.
 *
 * Print CSS rules of the road (applied via the print:* Tailwind variants):
 * - Hide the surrounding app chrome - invoice pages set body to use the
 *   minimal print layout, and any "Print" button on the page wraps itself
 *   in `print:hidden`.
 * - Force light-mode colors (we're b/w anyway, so this is mostly defensive).
 * - Page break inside the table is avoided where possible.
 */

export type InvoiceTone = "customer" | "seller" | "admin";

export interface InvoiceItem {
  title: string;
  slug?: string;
  sku?: string;
  options?: Record<string, string>;
  qty: number;
  /** Per-unit selling price at order time. */
  price: number;
  /** Pre-discount per-unit price; rendered struck-through when higher than `price`. */
  originalPrice?: number;
  lineTotal: number;
  /** Optional seller display name - admin invoice surfaces this; others omit. */
  sellerName?: string;
}

export interface InvoiceTotals {
  /**
   * For customer + admin: the full-order subtotal.
   * For seller: the *seller's* subtotal (the slice they're owed for).
   * Caller chooses what to pass - the component just renders.
   */
  subtotal: number;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  total: number;
  currency: string;
  /**
   * When set, the invoice renders a small advisory under the total noting
   * this is the seller's slice of a multi-seller order with the full
   * order's grand total surfaced for transparency.
   */
  fullOrderTotal?: number;
}

export interface OrderInvoiceProps {
  /**
   * Which role's invoice this is. Drives a few copy decisions (header
   * subtitle, whether to render an `internalNotes` line on admin) but no
   * data filtering - the caller is responsible for projecting items.
   */
  tone: InvoiceTone;
  /** Invoice / order number - rendered prominently. */
  orderNumber: string;
  /** Placed-at ISO date string. */
  placedAt: string;
  /** Optional delivered-at ISO date - included when the order is closed. */
  deliveredAt?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  shippingAddress: Address;
  /** Optional billing - falls back to shipping when omitted. */
  billingAddress?: Address;
  /** Customer name (and contact) for the bill-to block. */
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: InvoiceItem[];
  totals: InvoiceTotals;
  /** Optional coupon code applied. */
  couponCode?: string;
  /** Optional customer-supplied delivery note. */
  customerNote?: string;
  /** Admin-only - internal staff notes. Ignored for non-admin tones. */
  internalNotes?: string;
  /** Tracking carrier / number to surface on shipped+ orders. */
  tracking?: {
    carrier?: string;
    trackingNumber?: string;
  };
  /** Store name shown in the header - defaults to COMPANY.name. */
  storeName?: string;
}

/* ───────────────────── Helpers ───────────────────── */

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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function joinAddressLines(addr: Address): string[] {
  // Most addresses in BD render best as 3-4 lines: street/area, city/district,
  // division+postal, country. Empty fields are silently dropped so the block
  // doesn't grow tall white space on incomplete records.
  return [
    addr.line1,
    addr.line2,
    [addr.city, addr.district].filter(Boolean).join(", "),
    [addr.division, addr.postalCode].filter(Boolean).join(" "),
    addr.country,
  ].filter((s): s is string => Boolean(s && s.trim()));
}

const TONE_SUBTITLES: Record<InvoiceTone, string> = {
  customer: "Tax invoice & receipt",
  seller: "Delivery slip & seller copy",
  admin: "Admin copy - order record",
};

/* ───────────────────── Component ───────────────────── */

export function OrderInvoice({
  tone,
  orderNumber,
  placedAt,
  deliveredAt,
  status,
  paymentStatus,
  paymentMethod,
  shippingAddress,
  billingAddress,
  customer,
  items,
  totals,
  couponCode,
  customerNote,
  internalNotes,
  tracking,
  storeName = COMPANY.name,
}: OrderInvoiceProps) {
  const bill = billingAddress ?? shippingAddress;
  const ship = shippingAddress;

  // Surface seller attribution column only on admin tone.
  const showSellerColumn =
    tone === "admin" && items.some((i) => Boolean(i.sellerName));

  return (
    <article
      className="mx-auto max-w-3xl bg-paper text-ink print:max-w-none"
      aria-label={`Invoice for order ${orderNumber}`}
    >
      {/* Letterhead */}
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-ink pb-2">
        <div>
          <div className="text-2xl font-semibold tracking-tight">
            {storeName}
          </div>
          <div className="text-xs text-neutral-600">
            {TONE_SUBTITLES[tone]}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Invoice
          </div>
          <div className="font-mono text-lg">{orderNumber}</div>
          <div className="text-xs text-neutral-600">
            Placed {formatDate(placedAt)}
          </div>
          {deliveredAt ? (
            <div className="text-xs text-neutral-600">
              Delivered {formatDate(deliveredAt)}
            </div>
          ) : null}
        </div>
      </header>

      {/* Bill-to / Ship-to blocks */}
      <section className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Bill to
          </div>
          <div className="text-sm font-medium">{customer.name || bill.fullName}</div>
          {customer.email ? (
            <div className="text-xs text-neutral-600">{customer.email}</div>
          ) : null}
          {customer.phone || bill.phone ? (
            <div className="text-xs text-neutral-600">
              {customer.phone ?? bill.phone}
            </div>
          ) : null}
          {joinAddressLines(bill).map((line, i) => (
            <div key={i} className="text-xs text-neutral-700">
              {line}
            </div>
          ))}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Ship to
          </div>
          <div className="text-sm font-medium">{ship.fullName}</div>
          {ship.phone ? (
            <div className="text-xs text-neutral-600">{ship.phone}</div>
          ) : null}
          {joinAddressLines(ship).map((line, i) => (
            <div key={i} className="text-xs text-neutral-700">
              {line}
            </div>
          ))}
        </div>
      </section>

      {/* Status strip - three small badges so the printed slip can tell at
          a glance what state the order is in. */}
      <section className="mt-2 grid grid-cols-3 gap-1 border border-neutral-200 bg-neutral-50 p-1 text-xs print:bg-paper">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Status
          </div>
          <div className="font-medium capitalize">{status}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Payment
          </div>
          <div className="font-medium capitalize">
            {paymentStatus} · {paymentMethod}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Tracking
          </div>
          <div className="font-medium">
            {tracking?.trackingNumber
              ? `${tracking.carrier ?? ""} ${tracking.trackingNumber}`.trim()
              : "-"}
          </div>
        </div>
      </section>

      {/* Line items */}
      <section className="mt-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-[11px] uppercase tracking-wide text-neutral-600">
              <th className="py-1 pr-1 font-medium">Item</th>
              {showSellerColumn ? (
                <th className="py-1 pr-1 font-medium">Seller</th>
              ) : null}
              <th className="py-1 pr-1 text-right font-medium">Qty</th>
              <th className="py-1 pr-1 text-right font-medium">Price</th>
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={showSellerColumn ? 5 : 4}
                  className="py-2 text-center text-xs text-neutral-500"
                >
                  No items on this invoice.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={`${item.slug ?? item.title}-${idx}`}
                  className="border-b border-neutral-200 align-top break-inside-avoid"
                >
                  <td className="py-1 pr-1">
                    <div className="text-sm">{item.title}</div>
                    {item.sku || item.slug ? (
                      <div className="text-[11px] text-neutral-500">
                        SKU: {item.sku ?? item.slug}
                      </div>
                    ) : null}
                    {item.options && Object.keys(item.options).length > 0 ? (
                      <div className="text-[11px] text-neutral-500">
                        {Object.entries(item.options)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  {showSellerColumn ? (
                    <td className="py-1 pr-1 text-xs text-neutral-700">
                      {item.sellerName ?? "-"}
                    </td>
                  ) : null}
                  <td className="py-1 pr-1 text-right tabular-nums">{item.qty}</td>
                  <td className="py-1 pr-1 text-right tabular-nums">
                    {item.originalPrice && item.originalPrice > item.price ? (
                      <>
                        <span className="text-xs text-neutral-500 line-through">
                          {formatMoney(item.originalPrice, totals.currency)}
                        </span>{" "}
                      </>
                    ) : null}
                    {formatMoney(item.price, totals.currency)}
                  </td>
                  <td className="py-1 text-right font-medium tabular-nums">
                    {formatMoney(item.lineTotal, totals.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Totals - right-aligned block, mirrors the layout printable invoices
          have used since the days of carbon-copy books. */}
      <section className="mt-2 flex justify-end">
        <dl className="w-full max-w-xs space-y-0.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="tabular-nums">
              {formatMoney(totals.subtotal, totals.currency)}
            </dd>
          </div>
          {totals.shippingCost !== undefined ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600">Shipping</dt>
              <dd className="tabular-nums">
                {formatMoney(totals.shippingCost, totals.currency)}
              </dd>
            </div>
          ) : null}
          {totals.tax !== undefined && totals.tax > 0 ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600">Tax</dt>
              <dd className="tabular-nums">
                {formatMoney(totals.tax, totals.currency)}
              </dd>
            </div>
          ) : null}
          {totals.discount !== undefined && totals.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600">
                Discount
                {couponCode ? (
                  <span className="ml-0.5 font-mono text-xs">
                    ({couponCode})
                  </span>
                ) : null}
              </dt>
              <dd className="tabular-nums">
                −{formatMoney(totals.discount, totals.currency)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-ink pt-0.5 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">
              {formatMoney(totals.total, totals.currency)}
            </dd>
          </div>
          {totals.fullOrderTotal !== undefined &&
          totals.fullOrderTotal !== totals.total ? (
            <div className="pt-0.5 text-right text-[11px] text-neutral-500">
              Your slice of a multi-seller order. Order grand total:{" "}
              {formatMoney(totals.fullOrderTotal, totals.currency)}.
            </div>
          ) : null}
        </dl>
      </section>

      {/* Notes - customer-facing + (admin only) internal. */}
      {customerNote || (tone === "admin" && internalNotes) ? (
        <section className="mt-2 space-y-1">
          {customerNote ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Customer note
              </div>
              <p className="whitespace-pre-wrap text-xs text-neutral-700">
                {customerNote}
              </p>
            </div>
          ) : null}
          {tone === "admin" && internalNotes ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Internal notes
              </div>
              <p className="whitespace-pre-wrap text-xs text-neutral-700">
                {internalNotes}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="mt-3 border-t border-neutral-300 pt-1 text-center text-[11px] text-neutral-500">
        Thank you for shopping with {storeName}. Keep this invoice for your
        records.
      </footer>
    </article>
  );
}

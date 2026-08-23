"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AdminInvoiceSkeleton } from "@/components/admin/Skeleton";
import { useAdminOrder } from "@/hooks/useAdmin";
import { useAdminSiteSettings } from "@/hooks/useSiteSettings";
import { renderSymbology } from "@/lib/labels/engine";
import { COMPANY } from "@/lib/entity/company";
import type { Address } from "@/types/commerce";

/**
 * Shipping sticker - a compact portrait courier label distinct from the
 * full itemized invoice at /admin/orders/:id/invoice. Logo and company name
 * come from Settings (invoiceLogo, falling back to companyLogo; companyName)
 * so this never needs its own branding config. The barcode is the order
 * number, rendered through the shared label engine (lib/labels/engine.ts).
 *
 * Print size: 4" wide x 6" tall - the standard portrait shipping-label
 * orientation used by every major courier (a two-column 6"x4" landscape
 * attempt was tried and reverted: it repeatedly forced a 2nd printed page
 * because its content genuinely ran taller than the declared 4" page
 * height, and Chrome enforces that @page height as a real pagination
 * boundary even when the physical printer doesn't support the exact paper
 * size - 6" of height gives a wide safety margin for the same content).
 *
 * Layout matches the reference design exactly: full-width header (logo +
 * name), full-width date/order row, a bounded TO | From two-column row
 * (table/table-cell, not flex - see that section's own comment), then a
 * full-width barcode row. Only that middle row is two columns - it's not
 * spanning the whole page the way the reverted landscape attempt did, so
 * it stays well within the page-height budget instead of needing to
 * fragment across a page break.
 */

const WIDTH_IN = 4;
const HEIGHT_IN = 5.7;

const MAX_PRODUCT_LINES = 4;

function joinAddress(addr: Address): string {
  return [addr.line1, addr.line2, addr.city, addr.district, addr.division]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(", ");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  } catch {
    return iso;
  }
}

/** Case-insensitive lookup - admins can name the option "Size" or "size", either should surface here. */
function findSizeOption(options: Record<string, string> | undefined): string | undefined {
  if (!options) return undefined;
  const key = Object.keys(options).find((k) => k.trim().toLowerCase() === "size");
  return key ? options[key] : undefined;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[70px_1fr] gap-x-2 text-[11px] leading-snug">
      <span className="text-neutral-600">{label}</span>
      <span className="font-medium text-black">{children}</span>
    </div>
  );
}

export function OrderStickerClient({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError } = useAdminOrder(orderId);
  const { data: settings } = useAdminSiteSettings();

  const logoUrl = settings?.invoiceLogo || settings?.companyLogo || undefined;
  const companyName = settings?.companyName || COMPANY.name;
  const fromLine = [companyName, settings?.contact?.address].filter(Boolean).join(", ");

  const [barcodeSvg, setBarcodeSvg] = React.useState("");
  const [barcodeError, setBarcodeError] = React.useState("");

  React.useEffect(() => {
    if (!order) return;
    let cancelled = false;
    renderSymbology({
      value: order.orderNumber,
      symbology: "CODE128",
      heightMM: 14,
    })
      .then((r) => {
        if (!cancelled) setBarcodeSvg(r.svg.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, ""));
      })
      .catch((err: Error) => {
        if (!cancelled) setBarcodeError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [order]);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  if (isLoading) {
    return <AdminInvoiceSkeleton />;
  }
  if (isError || !order) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-1 p-4 text-center">
        <AlertTriangle className="h-3 w-3 text-neutral-500" aria-hidden />
        <p className="text-sm text-neutral-700">We couldn&rsquo;t load this order.</p>
        <Link href="/admin/orders">
          <Button variant="secondary">Back to orders</Button>
        </Link>
      </div>
    );
  }

  const visibleItems = order.items.slice(0, MAX_PRODUCT_LINES);
  const extraCount = order.items.length - visibleItems.length;

  return (
    <div className="mx-auto w-fit max-w-full p-2 print:m-0 print:w-full print:max-w-none print:p-0">
      <style>{`
        @page { size: ${WIDTH_IN}in ${HEIGHT_IN}in; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      <div className="mb-2 flex items-center justify-between gap-1 print:hidden">
        <Link
          href={`/admin/orders/${orderId}`}
          className="inline-flex items-center gap-0.5 text-sm text-neutral-600 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to order
        </Link>
        <Button onClick={handlePrint} variant="primary" size="sm">
          <Printer className="h-3.5 w-3.5" aria-hidden />
          <span className="ml-1">Print sticker</span>
        </Button>
      </div>

      {/* The sticker itself - see module docs above for the row structure
          and why this stays on one printed page. */}
      <article
        className="mx-auto flex max-w-full flex-col overflow-visible border-[3px] border-black bg-white text-black [break-inside:avoid] [page-break-inside:avoid] print:mx-0"
        style={{ width: `${WIDTH_IN}in`, minHeight: `${HEIGHT_IN}in` }}
        aria-label={`Shipping sticker for order ${order.orderNumber}`}
      >
        {/* Logo + company name. The <img> gets explicit numeric width/height
            attributes (not just CSS) so the browser never reserves layout
            space based on the source file's own intrinsic size before it's
            decoded - only the fixed 36x36 box below. `flex-none` on both
            rows here (and the date/order row) makes them explicitly
            non-growing, so only the barcode row (flex-1) can ever absorb
            leftover height. */}
        <div className="flex flex-none flex-col items-center gap-1 border-b-[3px] border-black px-4 py-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={companyName}
              width={36}
              height={36}
              className="h-9 w-9 max-w-[55%] object-contain"
            />
          ) : null}
          <div className="text-[18px] font-extrabold uppercase leading-none tracking-wide">
            {companyName}
          </div>
        </div>

        {/* Date / Order No. */}
        <div className="flex flex-none flex-col gap-1 border-b-[3px] border-black px-4 py-2">
          <Row label="Date:">{formatDate(order.createdAt)}</Row>
          <Row label="Order No.:">{order.orderNumber}</Row>
        </div>

        {/* TO | From - a bounded two-column row (table/table-cell, not
            flex, for reliable print-column handling), sitting between the
            full-width header/date and full-width barcode rather than
            spanning the whole page. This is the one place a page break
            could still land mid-column, but since this row is now only as
            tall as the address/product content (not the entire label like
            the earlier landscape attempt), it comfortably fits inside the
            overall page-height budget instead of needing to fragment. */}
        <div className="table w-full flex-none border-collapse border-b-[3px] border-black">
          <div className="table-row">
            <div className="table-cell px-4 py-2 align-top">
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex w-fit items-center bg-black px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  To
                </span>
                <div className="flex flex-col gap-1">
                  <Row label="Name:">{order.shippingAddress.fullName}</Row>
                  <Row label="Address:">{joinAddress(order.shippingAddress)}</Row>
                  <Row label="Phone:">{order.shippingAddress.phone}</Row>
                </div>
                <div className=" flex flex-col gap-1">
                  {visibleItems.map((item, i) => {
                    const size = findSizeOption(item.options);
                    return (
                      <Row key={item._id ?? i} label={i === 0 ? "Product:" : ""}>
                        {item.title}
                        {size ? <span className="ml-1 font-normal text-neutral-700">(Size: {size})</span> : null}
                        {item.qty > 1 ? <span className="ml-1 text-neutral-700">× {item.qty}</span> : null}
                      </Row>
                    );
                  })}
                  {extraCount > 0 ? (
                    <Row label="">+{extraCount} more item{extraCount === 1 ? "" : "s"}</Row>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="table-cell w-[1.2in] border-l-[3px] border-black px-3 py-2 align-top text-[11px]">
              <span className="text-neutral-600">From</span>
              <div className="whitespace-pre-line font-medium leading-snug text-black">{fromLine}</div>
            </div>
          </div>
        </div>

        {/* Barcode - the only row with flex-1 (everything above it is now
            explicitly flex-none), so this is the sole place leftover
            vertical space can land, always visibly centered around the
            barcode itself rather than showing up unpredictably elsewhere. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-1">
          {barcodeError ? (
            <span className="text-xs text-red-600">{barcodeError}</span>
          ) : barcodeSvg ? (
            <div
              className="[&_svg]:block [&_svg]:h-[40px] [&_svg]:w-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
            />
          ) : (
            <div className="h-[48px] w-[70%] animate-pulse rounded bg-neutral-100" />
          )}
        </div>
      </article>
    </div>
  );
}

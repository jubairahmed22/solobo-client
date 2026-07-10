"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingCart, MessageCircle, Plus, Minus, Trash2, X } from "lucide-react";
import { Drawer } from "@/components/complex";
import { useCartStore } from "@/store/cartStore";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { COMPANY } from "@/lib/entity/company";

/**
 * Storefront floating widgets - the persistent right-edge cart bubble and
 * the bottom-right WhatsApp shortcut. Mounted globally from the root
 * layout so every page gets them with zero per-page wiring.
 *
 * The cart bubble shows live item count + subtotal and opens a right-side
 * Drawer with a mini-cart (image, name, price, qty stepper, remove,
 * "PROCEED" CTA). The WhatsApp button deep-links to wa.me with whatever
 * number the admin configured in Site Settings → Contact.
 *
 * Both are auto-suppressed on /admin/*, /login, /register, /checkout and
 * any auth route - surfaces where a floating cart would compete with the
 * primary action or where contacting support over WhatsApp doesn't make
 * sense (e.g. an admin already inside the dashboard).
 */
export function FloatingWidgets() {
  const pathname = usePathname() ?? "/";

  // Routes where the floating bubble + WhatsApp button add more noise than
  // value. /cart and /checkout already have a primary cart UI; admin
  // routes have their own chrome.
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/forgot") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout");

  if (hidden) return null;

  return (
    <>
      <CartBubble />
      <WhatsAppBubble />
    </>
  );
}

/* ─────────────────────────────────── Cart bubble ─────────────────────── */

function CartBubble() {
  const [open, setOpen] = React.useState(false);

  // Avoid a hydration mismatch - the persist middleware only rehydrates
  // localStorage after the first client render, so server HTML would say
  // "0 items" while the client immediately re-renders with the saved cart.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const items = useCartStore((s) => s.items);
  const count = useCartStore((s) => s.count());
  const subtotal = useCartStore((s) => s.subtotal());

  const showCount = mounted ? count : 0;
  const showSubtotal = mounted ? subtotal : 0;

  return (
    <>
      {/* The "1 ITEMS / ৳199" pill, pinned to the right edge of the viewport
          a bit above mid-screen so it sits comfortably below the WhatsApp
          button column without colliding with sticky filters or the
          search-suggest dropdown. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open cart"
        className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-stretch overflow-hidden rounded-l-md text-left shadow-md lg:flex"
      >
        <span className="flex items-center justify-center gap-1 bg-ink px-2 py-1 text-paper">
          <ShoppingCart className="h-[15px] w-[15px]" aria-hidden />
          <span className="text-[9px] font-bold uppercase tracking-wide">
            {showCount} {showCount === 1 ? "Item" : "Items"}
          </span>
        </span>
        <span className="bg-accent px-2 py-1 text-center text-[10px] font-bold text-paper">
          {formatPrice(showSubtotal)}
        </span>
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        widthClassName="w-[92vw] sm:w-[420px]"
      >
        <div className="flex h-full flex-col">
          {/* Custom header so we can swap the X to the left edge per the
              reference screenshot (looks more like a slide-in panel than a
              modal that way). */}
          <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close cart"
              className="-m-1 inline-flex h-[32px] w-[32px] items-center justify-center rounded-sm text-ink hover:bg-neutral-100"
            >
              <X className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <h2 className="flex-1 text-center text-sm font-bold uppercase tracking-[0.2em] text-ink">
              Cart
            </h2>
            {/* Spacer so the title stays optically centred. */}
            <span className="h-[32px] w-[32px]" aria-hidden />
          </header>

          {/* Line items */}
          <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto">
            {items.length === 0 ? (
              <li className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-neutral-600">
                <ShoppingCart className="h-[40px] w-[40px] text-neutral-300" aria-hidden />
                <p>Your cart is empty.</p>
                <Link
                  href="/all-products"
                  onClick={() => setOpen(false)}
                  className="mt-1 text-xs font-bold uppercase tracking-wide text-ink hover:underline"
                >
                  Continue shopping →
                </Link>
              </li>
            ) : (
              items.map((item) => <CartLine key={item.lineId} item={item} onNavigate={() => setOpen(false)} />)
            )}
          </ul>

          {/* Footer total + CTA - kept inside the drawer so it stays in
              view even when the line-item list scrolls. */}
          {items.length > 0 ? (
            <footer className="border-t border-neutral-200 bg-paper px-3 py-2">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Cart total:
                </span>
                <span className="text-base font-bold text-ink">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="flex h-[48px] w-full items-center justify-center gap-1 rounded-xl bg-accent text-sm font-bold uppercase tracking-wider text-paper transition-opacity hover:opacity-90"
              >
                Proceed
                <span aria-hidden>›</span>
              </Link>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="mt-1.5 flex h-[40px] w-full items-center justify-center text-xs font-bold uppercase tracking-wider text-neutral-600 hover:text-ink"
              >
                View full cart
              </Link>
            </footer>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}

/* ─────────────────────────────────── Cart line ───────────────────────── */

interface CartLineProps {
  item: ReturnType<typeof useCartStore.getState>["items"][number];
  onNavigate: () => void;
}

function CartLine({ item, onNavigate }: CartLineProps) {
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);

  const onSale =
    typeof item.originalPrice === "number" && item.originalPrice > item.price;

  return (
    <li className="flex items-start gap-2.5 p-3">
      <Link
        href={`/product/${item.slug}`}
        onClick={onNavigate}
        className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
      >
        {item.image ? (
          <Image src={item.image} alt={item.title} fill sizes="56px" className="object-contain p-1" />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/product/${item.slug}`}
          onClick={onNavigate}
          className="line-clamp-2 text-[12px] leading-snug text-neutral-800 hover:text-ink hover:underline"
        >
          {item.title}
        </Link>

        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-semibold text-ink">{formatPrice(item.price)}</span>
          {onSale ? (
            <span className="text-[10px] text-neutral-400 line-through">
              {formatPrice(item.originalPrice!)}
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex items-center justify-between gap-1">
          <div className="flex h-[34px] items-center overflow-hidden rounded-lg border border-neutral-300">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty(item.lineId, item.qty - 1)}
              className="inline-flex h-full w-[34px] items-center justify-center text-ink hover:bg-neutral-100"
            >
              <Minus className="h-[14px] w-[14px]" aria-hidden />
            </button>
            <span className="w-[30px] text-center text-xs font-semibold tabular-nums">
              {item.qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty(item.lineId, item.qty + 1)}
              className="inline-flex h-full w-[34px] items-center justify-center text-ink hover:bg-neutral-100"
            >
              <Plus className="h-[14px] w-[14px]" aria-hidden />
            </button>
          </div>
          <span className="text-xs font-bold text-ink">
            {formatPrice(item.price * item.qty)}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-label={`Remove ${item.title}`}
        onClick={() => remove(item.lineId)}
        className="-mr-1 inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500"
      >
        <Trash2 className="h-[16px] w-[16px]" aria-hidden />
      </button>
    </li>
  );
}

/* ─────────────────────────────────── WhatsApp bubble ─────────────────── */

/**
 * Strip every character that isn't a digit. WhatsApp's wa.me protocol
 * expects E.164 without the leading "+", so a configured value like
 * "+880 1700-123 456" needs to become "8801700123456".
 */
function toWaNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  return digits.length >= 6 ? digits : null;
}

function WhatsAppBubble() {
  const { data: settings } = usePublicSiteSettings();
  const number = toWaNumber(settings?.contact?.whatsapp ?? settings?.contact?.phone);

  // Don't render until we know there's a number to dial - otherwise the
  // button is a dead click.
  if (!number) return null;

  // Pre-filled message gives the support agent helpful context out of the
  // gate. Encoded server-side to survive the URL roundtrip.
  const text = encodeURIComponent(
    `Hi ${settings?.companyName ?? COMPANY.name}, I have a question about an order/product.`,
  );
  const href = `https://wa.me/${number}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "fixed bottom-4 right-4 z-40 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full text-paper shadow-lg",
        "bg-[#25D366] transition-transform hover:scale-105 hover:shadow-xl",
      )}
    >
      <MessageCircle className="h-[26px] w-[26px]" aria-hidden />
    </a>
  );
}

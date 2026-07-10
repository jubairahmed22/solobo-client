"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Trash2, ShoppingCart, Tag, AlertTriangle, Truck, Lock, ChevronLeft } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { buttonVariants } from "@/components/ui/Button";
import { useCartStore, type CartItem } from "@/store/cartStore";
import {
  useServerCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useApplyCoupon,
  useRemoveCoupon,
  useClearCart,
} from "@/hooks/useCommerce";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";
import { useUIStore } from "@/store/uiStore";
import { trackBeginCheckout } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils/format";
import type {
  AppliedCoupon,
  CartCouponRejectionCode,
  ServerCart,
  ServerCartItem,
} from "@/types/commerce";

/**
 * Unified cart UI - backed by the server cart envelope for signed-in users
 * and the Zustand local cart for anonymous browsers. Both shapes are
 * normalised into a UnifiedItem before rendering so the markup stays the same.
 *
 * Coupon flow:
 *  - The envelope arrives with `appliedCoupon` populated when a stored
 *    `cart.couponCode` still validates. We surface the discount on the
 *    totals block and render the chip with a Remove affordance.
 *  - On apply, the backend re-runs the engine and either returns a fresh
 *    envelope (success) or a 422 with a structured `code` + `message`. The
 *    UI binds that error to the input as inline feedback and shows a toast.
 *  - On a stored code that's gone stale (`couponError`), we render a banner
 *    prompting the user to remove or pick a new code without surprising
 *    them at the checkout button.
 */

interface UnifiedItem {
  id: string;
  productId: string;
  slug: string;
  title: string;
  image?: string;
  price: number;
  originalPrice?: number;
  qty: number;
  options?: Record<string, string>;
  stock?: number;
}

function unifyServerItem(item: ServerCartItem): UnifiedItem {
  return {
    id: item._id,
    productId: item.product,
    slug: item.slug,
    title: item.title,
    image: item.image,
    price: item.price,
    originalPrice: item.originalPrice,
    qty: item.qty,
    options: item.options,
    stock: item.stock,
  };
}

function unifyLocalItem(item: CartItem): UnifiedItem {
  // cartStore v2 stores the full options map on every new row, so we
  // prefer that and only fall back to {size,color} for rows hydrated
  // from older persisted carts.
  let options: Record<string, string> | undefined;
  if (item.options && Object.keys(item.options).length > 0) {
    options = item.options;
  } else if (item.variant?.color || item.variant?.size) {
    const legacy: Record<string, string> = {};
    if (item.variant?.color) legacy.Color = item.variant.color;
    if (item.variant?.size) legacy.Size = item.variant.size;
    options = legacy;
  }
  return {
    id: item.lineId,
    productId: item.productId,
    slug: item.slug,
    title: item.title,
    image: item.image,
    price: item.price,
    originalPrice: item.originalPrice,
    qty: item.qty,
    options,
    stock: item.stock,
  };
}

export function CartClient() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const { data: publicSettings } = usePublicSiteSettings();
  const freeThreshold = publicSettings?.delivery?.freeShippingThreshold ?? 0;
  const insideDhaka = publicSettings?.delivery?.insideDhaka ?? 80;
  const outsideDhaka = publicSettings?.delivery?.outsideDhaka ?? 130;

  // Server-side cart envelope for authed users.
  const { data: envelope, isLoading: serverLoading } = useServerCart(isAuthed);
  const serverCart = envelope?.cart;
  const appliedCoupon = envelope?.appliedCoupon ?? null;
  const couponError = envelope?.couponError ?? null;

  const updateServer = useUpdateCartItem();
  const removeServer = useRemoveCartItem();
  const clearServer = useClearCart();
  const applyCouponServer = useApplyCoupon();
  const removeCouponServer = useRemoveCoupon();

  // Local cart for anonymous users.
  const localItems = useCartStore((s) => s.items);
  const localSetQty = useCartStore((s) => s.setQty);
  const localRemove = useCartStore((s) => s.remove);
  const localClear = useCartStore((s) => s.clear);

  const toast = useUIStore((s) => s.toast);
  const [couponInput, setCouponInput] = React.useState("");
  // Field-level error from the last failed apply call. We keep this in
  // local state so it's cleared the next time the user edits the input,
  // not just when the envelope refetches.
  const [couponFormError, setCouponFormError] = React.useState<string | null>(
    null,
  );

  // Source-of-truth selection. We prefer the server cart when the user is
  // authed AND the server has at least one row - that's the normal path post
  // merge. If the server is empty but the local cart has items, fall back to
  // local: it means either the merge hasn't run yet, the merge is in flight,
  // or it failed transiently (e.g., 429 from rate-limiter). Either way the
  // user keeps seeing the products they added instead of an empty page.
  const serverItemRows = isAuthed ? serverCart?.items ?? [] : [];
  const usingServer = serverItemRows.length > 0;

  const items: UnifiedItem[] = usingServer
    ? serverItemRows.map(unifyServerItem)
    : localItems.map(unifyLocalItem);

  const subtotal = usingServer
    ? serverCart?.subtotal ?? 0
    : items.reduce((s, i) => s + i.price * i.qty, 0);

  const currency = usingServer ? serverCart?.currency ?? "BDT" : "BDT";
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  // Mutations route based on which source is currently being shown, not on
  // auth status - otherwise an authed user looking at the local-cart fallback
  // would have their quantity changes silently dropped against the server.
  const onQtyChange = (item: UnifiedItem, qty: number) => {
    const next = Math.max(1, Math.min(item.stock ?? 99, qty));
    if (usingServer) {
      updateServer.mutate({ itemId: item.id, qty: next });
    } else {
      localSetQty(item.id, next);
    }
  };

  const onRemove = (item: UnifiedItem) => {
    if (usingServer) {
      removeServer.mutate(item.id);
    } else {
      localRemove(item.id);
    }
  };

  const onClear = () => {
    if (usingServer) {
      clearServer.mutate();
    } else {
      localClear();
    }
  };

  const onApplyCoupon = () => {
    if (!isAuthed) {
      toast({
        title: "Sign in to apply coupons",
        description: "Coupons are processed at checkout.",
        tone: "info",
      });
      return;
    }
    const code = couponInput.trim();
    if (!code) return;
    setCouponFormError(null);
    applyCouponServer.mutate(code, {
      onSuccess: () => {
        toast({ title: "Coupon applied", tone: "success" });
        setCouponInput("");
      },
      onError: (e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not apply coupon";
        setCouponFormError(message);
        toast({ title: "Coupon failed", description: message, tone: "error" });
      },
    });
  };

  const onRemoveCoupon = () => {
    if (!isAuthed) return;
    setCouponFormError(null);
    removeCouponServer.mutate();
  };

  const onCheckout = () => {
    if (items.length === 0) return;
    trackBeginCheckout({
      value: total,
      currency,
      items: items.reduce((s, i) => s + i.qty, 0),
    });
    router.push("/checkout");
  };

  if (isAuthed && serverLoading) {
    return (
      <div className="mt-3 flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyCart />;
  }

  // Total unit count across all rows - Amazon surfaces this in both the
  // items-card footer and the summary headline ("Subtotal (N items)").
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
    <div className="mt-4 grid grid-cols-1 gap-4 pb-24 sm:pb-0 sm:grid-cols-[1fr_260px] lg:grid-cols-[1fr_340px]">
      <section>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">

          {/* Card header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5 sm:px-5 sm:py-4">
            <h2 className="text-sm font-bold tracking-tight text-ink sm:text-lg">
              Shopping Cart
              <span className="ml-1.5 text-xs font-normal text-neutral-400 sm:ml-2 sm:text-sm">
                ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            </h2>
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 text-xs font-medium text-neutral-400 transition-colors hover:text-red-500"
            >
              Clear all
            </button>
          </div>

          <ul className="divide-y divide-neutral-50">
            {items.map((it) => (
              <li key={it.id} className="flex gap-2.5 px-3 py-3 sm:gap-4 sm:px-5 sm:py-5">

                {/* Product image */}
                <Link
                  href={`/product/${it.slug}`}
                  className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:h-[100px] sm:w-[100px]"
                >
                  {it.image ? (
                    <Image
                      src={it.image}
                      alt={it.title}
                      fill
                      sizes="(min-width: 640px) 100px, 80px"
                      className="object-cover"
                    />
                  ) : null}
                </Link>

                {/* Info */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/product/${it.slug}`}
                      className="line-clamp-2 flex-1 text-[13px] font-semibold leading-snug text-ink underline-offset-2 hover:underline sm:text-sm"
                    >
                      {it.title}
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-ink">
                        {formatPrice(it.price * it.qty, currency)}
                      </p>
                      {it.originalPrice && it.originalPrice > it.price ? (
                        <p className="text-[11px] text-neutral-400 line-through">
                          {formatPrice(it.originalPrice * it.qty, currency)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {it.options && Object.keys(it.options).length > 0 ? (
                    <p className="text-[11px] text-neutral-400">
                      {Object.entries(it.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </p>
                  ) : null}

                  {it.stock !== undefined && it.stock <= 5 ? (
                    <span className="text-[11px] font-medium text-amber-500">
                      Only {it.stock} left in stock
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-green-600">In stock</span>
                  )}

                  {/* Qty stepper + remove */}
                  <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex h-9 items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                      <button
                        type="button"
                        onClick={() => onQtyChange(it, it.qty - 1)}
                        disabled={it.qty <= 1}
                        aria-label="Decrease quantity"
                        className="flex h-full w-9 items-center justify-center text-sm text-ink transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-[32px] select-none text-center text-sm font-bold text-ink">
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQtyChange(it, it.qty + 1)}
                        disabled={it.stock !== undefined && it.qty >= it.stock}
                        aria-label="Increase quantity"
                        className="flex h-full w-9 items-center justify-center text-sm text-ink transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>

                    <div aria-hidden className="hidden h-3.5 w-px bg-neutral-200 sm:block" />

                    <button
                      type="button"
                      onClick={() => onRemove(it)}
                      aria-label={`Remove ${it.title}`}
                      className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 sm:px-5 sm:py-3.5">
            <Link
              href="/all-products"
              className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs text-neutral-400 transition-colors hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Continue shopping
            </Link>
            <p className="shrink-0 whitespace-nowrap text-sm text-neutral-600">
              Subtotal:{" "}
              <span className="font-bold text-ink">{formatPrice(subtotal, currency)}</span>
            </p>
          </div>
        </div>
      </section>

      <Summary
        cart={isAuthed ? serverCart ?? null : null}
        appliedCoupon={appliedCoupon}
        couponError={couponError}
        couponFormError={couponFormError}
        subtotal={subtotal}
        discount={discount}
        total={total}
        currency={currency}
        itemCount={itemCount}
        freeThreshold={freeThreshold}
        insideDhaka={insideDhaka}
        outsideDhaka={outsideDhaka}
        couponInput={couponInput}
        onCouponInputChange={(v) => {
          setCouponInput(v);
          if (couponFormError) setCouponFormError(null);
        }}
        onApplyCoupon={onApplyCoupon}
        onRemoveCoupon={onRemoveCoupon}
        onCheckout={onCheckout}
        applyingCoupon={applyCouponServer.isPending}
        removingCoupon={removeCouponServer.isPending}
        isAuthed={isAuthed}
      />
    </div>

    {/* Mobile sticky checkout bar */}
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-3 bg-white px-4 pt-3 shadow-[0_-1px_0_rgba(0,0,0,0.06),0_-8px_24px_rgba(0,0,0,0.08)] sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-neutral-400">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
        <p className="text-base font-bold text-ink">{formatPrice(total, currency)}</p>
      </div>
      <Button variant="accent" onClick={onCheckout} size="md" className="shrink-0 rounded-xl">
        <ShoppingCart className="h-[14px] w-[14px]" aria-hidden />
        <span className="ml-1.5">Checkout</span>
      </Button>
    </div>
    </>
  );
}

/* ───────────── Order summary side card ───────────── */

interface SummaryProps {
  cart: ServerCart | null;
  appliedCoupon: AppliedCoupon | null;
  couponError: { code: CartCouponRejectionCode; message: string } | null;
  couponFormError: string | null;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  itemCount: number;
  freeThreshold: number;
  insideDhaka: number;
  outsideDhaka: number;
  couponInput: string;
  onCouponInputChange: (v: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onCheckout: () => void;
  applyingCoupon: boolean;
  removingCoupon: boolean;
  isAuthed: boolean;
}

function Summary({
  cart,
  appliedCoupon,
  couponError,
  couponFormError,
  subtotal,
  discount,
  total,
  currency,
  itemCount,
  freeThreshold,
  insideDhaka,
  outsideDhaka,
  couponInput,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  onCheckout,
  applyingCoupon,
  removingCoupon,
  isAuthed,
}: SummaryProps) {
  const isFree = freeThreshold > 0 && subtotal >= freeThreshold;
  const amountToFree = freeThreshold > 0 ? Math.max(0, freeThreshold - subtotal) : 0;
  const progressPct = freeThreshold > 0 ? Math.min(100, (subtotal / freeThreshold) * 100) : 0;
  // A stored code can be in three states from the buyer's POV:
  //  - applied + valid     → appliedCoupon !== null
  //  - applied + stale     → cart.couponCode set, appliedCoupon null, couponError set
  //  - not applied         → cart.couponCode falsy, appliedCoupon null
  const hasStaleCode =
    !!cart?.couponCode && !appliedCoupon && !!couponError;

  return (
    <aside className="self-start overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] sm:sticky sm:top-20">

      {/* ── CTA + price ── */}
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-sm text-neutral-400">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
          <p className="text-xl font-bold text-ink">{formatPrice(total, currency)}</p>
        </div>

        <Button variant="accent" onClick={onCheckout} size="md" fullWidth>
          <ShoppingCart className="h-[14px] w-[14px]" aria-hidden />
          <span className="ml-1.5">Proceed to Checkout</span>
        </Button>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
          <Lock className="h-3 w-3" aria-hidden />
          Secure &amp; encrypted checkout
        </div>

        {!isAuthed ? (
          <p className="mt-2 text-center text-xs text-neutral-400">
            <Link
              href="/login?next=/checkout"
              className="font-semibold text-ink underline underline-offset-2 hover:opacity-70"
            >
              Sign in
            </Link>{" "}
            for a faster checkout
          </p>
        ) : null}
      </div>

      {/* ── Free delivery progress ── */}
      {freeThreshold > 0 ? (
        <div className="border-t border-neutral-100 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-neutral-600">
              <Truck className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
              {isFree ? (
                <span className="font-semibold text-green-600">Free delivery unlocked!</span>
              ) : (
                <span>
                  Add{" "}
                  <span className="font-semibold text-ink">
                    {formatPrice(amountToFree, currency)}
                  </span>{" "}
                  more for free delivery
                </span>
              )}
            </span>
            <span className="shrink-0 text-neutral-400">{formatPrice(freeThreshold, currency)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isFree ? "bg-green-500" : "bg-accent"}`}
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      ) : null}

      {/* ── Price breakdown ── */}
      <div className="border-t border-neutral-100 px-4 pb-3 pt-4 sm:px-5">
        <h2 className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
          Order Summary
        </h2>
        <div className="flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span className="font-medium text-ink">{formatPrice(subtotal, currency)}</span>
          </div>
          {appliedCoupon ? (
            <div className="flex justify-between">
              <span className="text-neutral-500">Discount</span>
              <span className="font-medium text-green-600">
                −{formatPrice(discount, currency)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-neutral-500">Shipping</span>
            {isFree ? (
              <span className="font-semibold text-green-600">Free</span>
            ) : freeThreshold > 0 ? (
              <span className="text-neutral-400">
                {formatPrice(insideDhaka, currency)}–{formatPrice(outsideDhaka, currency)}
              </span>
            ) : (
              <span className="text-neutral-400">Calculated at checkout</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Coupon ── */}
      <div className="border-t border-neutral-100 px-4 py-3.5 sm:px-5 sm:py-4">
        {isAuthed && appliedCoupon ? (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm">
              <Tag className="h-3.5 w-3.5 text-green-600" aria-hidden />
              <span className="font-bold text-green-800">{appliedCoupon.code}</span>
              <span className="text-xs text-green-600">
                {appliedCoupon.type === "percent"
                  ? `${appliedCoupon.value}% off`
                  : `${formatPrice(appliedCoupon.value, currency)} off`}
              </span>
            </span>
            <button
              type="button"
              onClick={onRemoveCoupon}
              disabled={removingCoupon}
              className="text-xs text-neutral-400 transition-colors hover:text-red-500 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 transition-colors focus-within:border-neutral-400 focus-within:bg-white">
              <Tag className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
              <input
                value={couponInput}
                onChange={(e) => onCouponInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onApplyCoupon()}
                placeholder="Enter coupon code"
                aria-label="Coupon code"
                aria-invalid={!!couponFormError || undefined}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={applyingCoupon || !couponInput.trim()}
                className="shrink-0 text-xs font-bold uppercase tracking-widest text-accent transition-colors hover:opacity-70 disabled:text-neutral-300"
              >
                {applyingCoupon ? "…" : "Apply"}
              </button>
            </div>
            {couponFormError ? (
              <p className="mt-1.5 text-xs text-red-500" role="alert">
                {couponFormError}
              </p>
            ) : null}
          </>
        )}

        {hasStaleCode ? (
          <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-ink">
                Coupon &ldquo;{cart?.couponCode}&rdquo; no longer applies
              </p>
              <p className="mt-0.5 text-neutral-500">{couponError?.message}</p>
            </div>
            <button
              type="button"
              onClick={onRemoveCoupon}
              disabled={removingCoupon}
              className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Total ── */}
      <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3.5 sm:px-5 sm:py-4">
        <span className="text-base font-bold text-ink">Total</span>
        <div className="text-right">
          <p className="text-lg font-bold text-ink">{formatPrice(total, currency)}</p>
          <p className="text-[10px] text-neutral-400">Incl. all taxes</p>
        </div>
      </div>
    </aside>
  );
}

/* ───────────── Empty state ───────────── */

function EmptyCart() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-14 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
        <ShoppingCart className="h-6 w-6 text-neutral-400" aria-hidden />
      </div>
      <div>
        <p className="text-base font-bold text-ink">Your cart is empty</p>
        <p className="mt-1 text-sm text-neutral-500">
          Looks like you haven&apos;t added anything yet.
        </p>
      </div>
      <Link
        href="/all-products"
        className={buttonVariants({ variant: "accent", size: "md", className: "mt-1 rounded-xl" })}
      >
        Start shopping
      </Link>
    </div>
  );
}

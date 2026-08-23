"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus } from "lucide-react";
import { chatApi, ChatError } from "@/lib/api/chat";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CheckoutForm, CheckoutFormVariant, OrderPlaced } from "@/types/chat";

interface ChatCheckoutFormProps {
  form: CheckoutForm;
  sessionId: string;
  onClose: () => void;
}

function resolveVariant(
  variants: CheckoutFormVariant[],
  selected: Record<string, string>,
  axisKeys: string[],
): CheckoutFormVariant | undefined {
  if (variants.length === 0) return undefined;
  return variants.find((v) => axisKeys.every((k) => v.options[k] === selected[k]));
}

export function ChatCheckoutForm({ form, sessionId, onClose }: ChatCheckoutFormProps) {
  const router = useRouter();
  const addToCart = useCartStore((s) => s.add);

  const axisKeys = React.useMemo(
    () => Array.from(new Set(form.variants.flatMap((v) => Object.keys(v.options)))),
    [form.variants],
  );

  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>(() => {
    const firstInStock = form.variants.find((v) => v.stock > 0) ?? form.variants[0];
    return firstInStock ? { ...firstInStock.options } : {};
  });

  const selectedVariant = resolveVariant(form.variants, selectedOptions, axisKeys);
  const hasVariants = form.variants.length > 0;
  const variantResolved = !hasVariants || Boolean(selectedVariant);

  const effectivePrice = selectedVariant?.price ?? form.price;
  const effectiveStock = hasVariants ? (selectedVariant?.stock ?? 0) : form.stock;
  const maxQty = form.trackStock ? Math.max(1, Math.min(effectiveStock, 99)) : 99;
  const outOfStock = form.trackStock && variantResolved && effectiveStock <= 0;

  const [qty, setQty] = React.useState(1);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [line1, setLine1] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [city, setCity] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"cod" | "online">("cod");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = React.useState<OrderPlaced | null>(null);

  React.useEffect(() => {
    setQty((q) => Math.min(q, Math.max(1, maxQty)));
  }, [maxQty]);

  if (placedOrder) {
    return (
      <div className="mt-1 w-full max-w-[280px] rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
        <p className="font-bold text-ink">Order confirmed - #{placedOrder.orderNumber}</p>
        <p className="text-neutral-600">
          Total {formatPrice(placedOrder.total, placedOrder.currency)} · Cash on Delivery
        </p>
        <a
          href={placedOrder.url}
          className="mt-1 inline-block text-xs font-bold uppercase tracking-wide text-ink underline underline-offset-2"
        >
          View order →
        </a>
      </div>
    );
  }

  const canSubmitCod =
    !submitting &&
    variantResolved &&
    !outOfStock &&
    fullName.trim().length >= 2 &&
    phone.trim().length >= 5 &&
    line1.trim().length >= 3 &&
    district.trim().length >= 1;

  async function handlePlaceOrder() {
    if (!canSubmitCod) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await chatApi.checkout({
        sessionId,
        productId: form.productId,
        variantId: selectedVariant?.id,
        qty,
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: {
          line1: line1.trim(),
          city: city.trim() || undefined,
          district: district.trim(),
        },
      });
      setPlacedOrder(res.orderPlaced);
    } catch (err) {
      setError(err instanceof ChatError ? err.message : "Something went wrong placing your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePayOnline() {
    addToCart({
      productId: form.productId,
      variantId: selectedVariant?.id,
      options: hasVariants ? selectedOptions : undefined,
      slug: form.slug,
      title: form.title,
      image: form.image ?? "",
      price: effectivePrice,
      originalPrice: form.compareAtPrice,
      qty,
      stock: form.trackStock ? effectiveStock : undefined,
    });
    onClose();
    router.push("/checkout");
  }

  return (
    <div className="mt-1 w-full max-w-[300px] rounded-xl border border-neutral-200 bg-paper p-3">
      {/* Product header */}
      <div className="flex items-center gap-2.5">
        {form.image ? (
          <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <Image src={form.image} alt={form.title} fill sizes="52px" className="object-contain p-1" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-ink">{form.title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-ink">{formatPrice(effectivePrice, form.currency)}</span>
            {form.compareAtPrice && form.compareAtPrice > effectivePrice ? (
              <span className="text-[11px] text-neutral-400 line-through">
                {formatPrice(form.compareAtPrice, form.currency)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Variant pickers */}
      {axisKeys.length > 0 ? (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {axisKeys.map((axis) => {
            const values = Array.from(
              new Set(form.variants.map((v) => v.options[axis]).filter((v): v is string => Boolean(v))),
            );
            return (
              <div key={axis}>
                <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{axis}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {values.map((val) => {
                    const active = selectedOptions[axis] === val;
                    // Approximation for multi-axis products (ignores other selected
                    // axes) - good enough to flag a value that's dead everywhere.
                    const available = form.variants.some((v) => v.options[axis] === val && v.stock > 0);
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={!available}
                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [axis]: val }))}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] font-medium",
                          !available
                            ? "border-neutral-200 text-neutral-300 line-through"
                            : active
                              ? "border-ink bg-ink text-paper"
                              : "border-neutral-300 text-neutral-700 hover:border-ink",
                        )}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {outOfStock ? (
        <p className="mt-2 text-xs font-semibold text-red-600">Out of stock for this selection.</p>
      ) : (
        <>
          {/* Qty stepper */}
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Quantity</span>
            <div className="flex h-[30px] items-center overflow-hidden rounded-lg border border-neutral-300">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="inline-flex h-full w-[28px] items-center justify-center text-ink hover:bg-neutral-100 disabled:opacity-30"
              >
                <Minus className="h-[12px] w-[12px]" aria-hidden />
              </button>
              <span className="w-[26px] text-center text-xs font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty}
                className="inline-flex h-full w-[28px] items-center justify-center text-ink hover:bg-neutral-100 disabled:opacity-30"
              >
                <Plus className="h-[12px] w-[12px]" aria-hidden />
              </button>
            </div>
          </div>

          {/* Payment method */}
          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setPaymentMethod("cod")}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-bold",
                paymentMethod === "cod" ? "border-ink bg-ink text-paper" : "border-neutral-300 text-neutral-700",
              )}
            >
              Cash on Delivery
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("online")}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-bold",
                paymentMethod === "online" ? "border-ink bg-ink text-paper" : "border-neutral-300 text-neutral-700",
              )}
            >
              Pay Online
            </button>
          </div>

          {paymentMethod === "cod" ? (
            <div className="mt-2.5 flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-[32px] rounded-lg border border-neutral-300 px-2.5 text-xs outline-none focus:border-ink"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-[32px] rounded-lg border border-neutral-300 px-2.5 text-xs outline-none focus:border-ink"
              />
              <input
                type="text"
                placeholder="Address (house, road, area)"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="h-[32px] rounded-lg border border-neutral-300 px-2.5 text-xs outline-none focus:border-ink"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="District (e.g. Dhaka)"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="h-[32px] flex-1 rounded-lg border border-neutral-300 px-2.5 text-xs outline-none focus:border-ink"
                />
                <input
                  type="text"
                  placeholder="City (optional)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-[32px] flex-1 rounded-lg border border-neutral-300 px-2.5 text-xs outline-none focus:border-ink"
                />
              </div>

              {error ? <p className="text-[11px] font-medium text-red-600">{error}</p> : null}

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={!canSubmitCod}
                className="mt-0.5 flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-bold uppercase tracking-wide text-paper disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : null}
                Place Order · {formatPrice(effectivePrice * qty, form.currency)}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePayOnline}
              disabled={!variantResolved}
              className="mt-2.5 flex h-[38px] w-full items-center justify-center rounded-lg bg-accent text-xs font-bold uppercase tracking-wide text-paper disabled:opacity-40"
            >
              Continue to Checkout · {formatPrice(effectivePrice * qty, form.currency)}
            </button>
          )}
        </>
      )}
    </div>
  );
}

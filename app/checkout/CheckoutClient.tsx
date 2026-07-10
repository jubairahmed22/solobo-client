"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Lock, Minus, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label, Spinner, Badge } from "@/components/ui";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { getCheckoutAttribution } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils/format";
import { useUIStore } from "@/store/uiStore";
import { useCartStore, type CartItem } from "@/store/cartStore";
import {
  useServerCart,
  useAddresses,
  useCheckout,
  useMergeCart,
  useUpdateCartItem,
  useRemoveCartItem,
} from "@/hooks/useCommerce";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";
import type {
  Address,
  AddressInput,
  AppliedCoupon,
  CartCouponRejectionCode,
  MergeCartItem,
  PaymentMethod,
  ServerCart,
  ServerCartItem,
} from "@/types/commerce";

/* ───────────────────── Address form ───────────────────── */

const addressFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  phone: z.string().min(5, "Phone number is required").max(20),
  altPhone: z.string().max(20).optional().or(z.literal("")),
  line1: z.string().min(3, "Address is required").max(200),
  line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(1, "City is required").max(80),
  district: z.string().min(1, "District is required").max(80),
  division: z.string().max(80).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(3).optional(),
  saveAddress: z.boolean().optional(),
});

type AddressFormValues = z.infer<typeof addressFormSchema>;

const PAYMENT_OPTIONS: Array<{ id: PaymentMethod; label: string; description: string }> = [
  { id: "cod", label: "Cash on delivery", description: "Pay in cash when your order arrives." },
  { id: "bkash", label: "bKash", description: "Pay via bKash mobile banking." },
  { id: "nagad", label: "Nagad", description: "Pay via Nagad mobile banking." },
  { id: "rocket", label: "Rocket", description: "Pay via Rocket (DBBL) mobile banking." },
  {
    id: "sslcommerz",
    label: "SSLCommerz",
    description: "Cards, mobile banking, and net banking - Bangladesh's local gateway.",
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "International cards (Visa / Mastercard / AmEx) via Stripe.",
  },
  { id: "paypal", label: "PayPal", description: "Pay with a PayPal balance or linked card." },
  { id: "card", label: "Card (direct)", description: "Visa, Mastercard, or AmEx." },
  { id: "bank_transfer", label: "Bank transfer", description: "Direct bank deposit." },
];

/* ───────────────────── Local → Server cart adapter ───────────────────── */

/**
 * Build a synthetic `ServerCart` from the local Zustand cart so the existing
 * OrderSummary can render unchanged. We deliberately keep the same field
 * names the server uses (`product`, `slug`, `title`, `image`, `price`, `qty`)
 * because the summary component is typed against `ServerCart`.
 *
 * Authed users on /checkout normally arrive with a server-side cart, but if
 * the login-merge is still in-flight or failed (429, network blip), the
 * server cart can read empty while the local cart still holds the items they
 * just added. Falling back here keeps the buyer from staring at an empty
 * cart message after they explicitly clicked "Checkout".
 */
function buildLocalCartShim(items: CartItem[]): ServerCart {
  const now = new Date().toISOString();
  const shimItems: ServerCartItem[] = items.map((it) => {
    // Prefer the full options map written by cartStore v2; only fall back
    // to the legacy {size,color} fields when the row was hydrated from an
    // older persisted cart. This keeps "Storage: 128GB" / "Material: Cotton"
    // axes visible in the summary instead of silently dropping them.
    let options: Record<string, string> | undefined;
    if (it.options && Object.keys(it.options).length > 0) {
      options = it.options;
    } else if (it.variant?.color || it.variant?.size) {
      const legacy: Record<string, string> = {};
      if (it.variant?.color) legacy.Color = it.variant.color;
      if (it.variant?.size) legacy.Size = it.variant.size;
      options = legacy;
    }
    return {
      _id: it.lineId,
      product: it.productId,
      variantId: it.variantId,
      slug: it.slug,
      title: it.title,
      image: it.image,
      options,
      price: it.price,
      originalPrice: it.originalPrice,
      currency: "BDT",
      qty: it.qty,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = items.reduce((n, i) => n + i.qty, 0);
  return {
    _id: "local-cart",
    user: "local",
    items: shimItems,
    subtotal,
    itemCount,
    currency: "BDT",
    createdAt: now,
    updatedAt: now,
  };
}

function localItemsToMergePayload(items: CartItem[]): MergeCartItem[] {
  // Same preference order as CartSyncBridge - send the most specific
  // identifier we have so the server can deterministically pick the
  // variant row instead of failing with VARIANT_REQUIRED on products
  // whose axes aren't named "Size"/"Color".
  return items.map((it) => {
    if (it.variantId) {
      return { productId: it.productId, variantId: it.variantId, qty: it.qty };
    }
    if (it.options && Object.keys(it.options).length > 0) {
      return { productId: it.productId, options: it.options, qty: it.qty };
    }
    const legacy: Record<string, string> = {};
    if (it.variant?.color) legacy.Color = it.variant.color;
    if (it.variant?.size) legacy.Size = it.variant.size;
    return {
      productId: it.productId,
      qty: it.qty,
      options: Object.keys(legacy).length > 0 ? legacy : undefined,
    };
  });
}

/* ───────────────────── Page client ───────────────────── */

export function CheckoutClient() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const toast = useUIStore((s) => s.toast);
  const { data: publicSettings } = usePublicSiteSettings();
  const deliveryConfig = publicSettings?.delivery;

  // Redirect anon users to sign in once we know they're not authed.
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=/checkout");
    }
  }, [status, router]);

  // The cart query returns a CartEnvelope ({ cart, appliedCoupon, couponError }).
  // We pull the slice plus the resolved discount so the summary can render
  // the actual amount the buyer will pay - checkout re-validates anyway, so
  // a stale `appliedCoupon` here just shows up as a corrected discount line
  // on the order success page, not a surprise.
  const { data: envelope, isLoading: cartLoading } = useServerCart(isAuthed);
  const serverCart = envelope?.cart;
  const appliedCoupon = envelope?.appliedCoupon ?? null;
  const couponError = envelope?.couponError ?? null;
  const { data: addresses, isLoading: addrLoading } = useAddresses(isAuthed);
  const checkoutMut = useCheckout();
  const mergeMut = useMergeCart();

  // Local-cart fallback. If the server cart is empty (or still loading the
  // login-merge), the local Zustand cart is the source of truth for what the
  // buyer thinks they're checking out with. We render those items in the
  // summary and merge them up to the server right before placing the order.
  const localItems = useCartStore((s) => s.items);
  const clearLocal = useCartStore((s) => s.clear);
  const localSetQty = useCartStore((s) => s.setQty);
  const localRemove = useCartStore((s) => s.remove);

  const updateItemMut = useUpdateCartItem();
  const removeItemMut = useRemoveCartItem();

  const serverItems = serverCart?.items ?? [];
  const usingLocal = serverItems.length === 0 && localItems.length > 0;

  const handleUpdateQty = (itemId: string, qty: number) => {
    if (usingLocal) {
      localSetQty(itemId, qty);
    } else {
      updateItemMut.mutate({ itemId, qty });
    }
  };

  const handleRemove = (itemId: string) => {
    if (usingLocal) {
      localRemove(itemId);
    } else {
      removeItemMut.mutate(itemId);
    }
  };
  const cart: ServerCart | undefined = usingLocal
    ? buildLocalCartShim(localItems)
    : serverCart;

  const [selectedAddressId, setSelectedAddressId] = React.useState<string | "new" | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cod");
  const [customerNote, setCustomerNote] = React.useState("");

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      altPhone: "",
      line1: "",
      line2: "",
      city: "",
      district: "",
      division: "",
      postalCode: "",
      country: "BD",
      saveAddress: true,
    },
  });

  // Pick the default address by default.
  React.useEffect(() => {
    if (!addresses) return;
    if (selectedAddressId) return;
    if (addresses.length === 0) {
      setSelectedAddressId("new");
      return;
    }
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    setSelectedAddressId(def?._id ?? "new");
  }, [addresses, selectedAddressId]);

  if (status === "loading" || cartLoading || addrLoading) {
    return (
      <div className="mt-3 flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-paper py-8 text-center">
        <p className="text-base font-medium">Your cart is empty</p>
        <p className="text-sm text-neutral-600">Add a few items before checking out.</p>
        <Link href="/all-products" className={buttonVariants({ variant: "primary", size: "md", className: "mt-1" })}>
          Browse products
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: AddressFormValues) => {
    try {
      // If we're rendering from the local cart, push it up to the server
      // first so the checkout controller has the right line items to charge
      // against. The merge endpoint reports per-item skips (deleted product,
      // variant resolution failed, out of stock, etc.) instead of failing the
      // whole batch, so we inspect the envelope before deciding what to do:
      //   - 0 items merged → cart would be empty server-side; bail with the
      //     first skip reason so the user knows why instead of seeing a
      //     generic EMPTY_CART at checkout.
      //   - some items merged with skips → warn but proceed. The buyer can
      //     review what made it through on the order success page.
      //   - everything merged → silently clear local + continue.
      if (usingLocal && localItems.length > 0) {
        try {
          const envelopeAfterMerge = await mergeMut.mutateAsync(
            localItemsToMergePayload(localItems),
          );
          const skipped = envelopeAfterMerge.skipped ?? [];
          const mergedCount = envelopeAfterMerge.mergedCount ?? 0;
          const serverItemsAfter = envelopeAfterMerge.cart?.items ?? [];

          if (mergedCount === 0 && serverItemsAfter.length === 0) {
            const reason =
              skipped[0]?.message ??
              "None of your cart items could be added to the order";
            toast({
              title: "Could not place order",
              description: reason,
              tone: "error",
            });
            return;
          }

          if (skipped.length > 0) {
            toast({
              title: `${skipped.length} item${skipped.length > 1 ? "s" : ""} skipped`,
              description: skipped[0]?.message ?? "Some items could not be added.",
              tone: "info",
            });
          }
          clearLocal();
        } catch (mergeErr) {
          const msg =
            mergeErr instanceof Error
              ? mergeErr.message
              : "Could not sync your cart to the server";
          toast({ title: "Could not place order", description: msg, tone: "error" });
          return;
        }
      }

      const useSaved = selectedAddressId && selectedAddressId !== "new";

      // Snapshot marketing attribution at the moment of purchase so the
      // server can persist it on the order + user and stitch server-side
      // conversions (GA4 MP, Meta CAPI) to this session.
      const attribution = getCheckoutAttribution();

      let body: Parameters<typeof checkoutMut.mutateAsync>[0];
      if (useSaved && typeof selectedAddressId === "string") {
        body = {
          shippingAddressId: selectedAddressId,
          paymentMethod,
          customerNote: customerNote || undefined,
          attribution,
        };
      } else {
        const inline: AddressInput = {
          fullName: values.fullName,
          phone: values.phone,
          altPhone: values.altPhone || undefined,
          line1: values.line1,
          line2: values.line2 || undefined,
          city: values.city,
          district: values.district,
          division: values.division || undefined,
          postalCode: values.postalCode || undefined,
          country: values.country || "BD",
        };
        body = {
          shippingAddress: inline,
          paymentMethod,
          customerNote: customerNote || undefined,
          saveAddress: values.saveAddress,
          attribution,
        };
      }

      const order = await checkoutMut.mutateAsync(body);
      // Belt-and-braces: clear the local cart on a successful checkout so a
      // user with stale local rows doesn't see a phantom badge after the
      // server-side order is placed.
      if (localItems.length > 0) clearLocal();
      toast({ title: "Order placed", description: order.orderNumber, tone: "success" });
      router.push(`/order/${order.orderNumber}/success`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not place order";
      toast({ title: "Checkout failed", description: message, tone: "error" });
    }
  };

  // When the user picks a saved address, skip RHF validation and just submit.
  const handlePlaceOrder = () => {
    if (selectedAddressId && selectedAddressId !== "new") {
      onSubmit(form.getValues());
    } else {
      form.handleSubmit(onSubmit)();
    }
  };

  const subtotal = cart.subtotal;
  const shippingCost = estimateShipping(
    getDistrictFromSelection(addresses, selectedAddressId, form.watch("district")),
    subtotal,
    deliveryConfig,
  );
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + shippingCost;
  const freeThreshold = deliveryConfig?.freeShippingThreshold ?? 0;

  return (
    <>
    <div className="mt-3 grid grid-cols-1 gap-3 pb-24 sm:pb-0 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <ShippingAddressBlock
          addresses={addresses ?? []}
          selectedId={selectedAddressId}
          onSelect={setSelectedAddressId}
          form={form}
        />

        <PaymentBlock value={paymentMethod} onChange={setPaymentMethod} enabledMethods={publicSettings?.enabledPaymentMethods} />

        <section className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-paper p-4">
          <h2 className="text-base font-semibold text-ink">Order note <span className="text-sm font-normal text-neutral-400">(optional)</span></h2>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="Anything our delivery team should know?"
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-neutral-200 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
          />
        </section>
      </div>

      <OrderSummary
        cart={cart}
        appliedCoupon={appliedCoupon}
        couponError={couponError}
        subtotal={subtotal}
        discount={discount}
        shippingCost={shippingCost}
        freeThreshold={freeThreshold}
        total={total}
        onPlaceOrder={handlePlaceOrder}
        isPlacing={checkoutMut.isPending || mergeMut.isPending}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
      />
    </div>

    {/* Mobile sticky place-order bar */}
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-3 border-t border-neutral-200 bg-white px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">Total</p>
        <p className="text-base font-bold text-ink">{formatPrice(total, cart.currency)}</p>
      </div>
      <Button
        onClick={handlePlaceOrder}
        loading={checkoutMut.isPending || mergeMut.isPending}
        size="md"
        className="shrink-0 rounded-xl"
      >
        <Lock className="h-[14px] w-[14px]" />
        <span className="ml-1.5">Place order</span>
      </Button>
    </div>
    </>
  );
}

/* ───────────────────── Shipping address block ───────────────────── */

interface ShippingAddressBlockProps {
  addresses: Address[];
  selectedId: string | "new" | null;
  onSelect: (id: string | "new") => void;
  form: ReturnType<typeof useForm<AddressFormValues>>;
}

function ShippingAddressBlock({ addresses, selectedId, onSelect, form }: ShippingAddressBlockProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-paper p-4">
      <h2 className="text-base font-semibold text-ink">Shipping address</h2>

      {addresses.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {addresses.map((a) => {
            const active = selectedId === a._id;
            return (
              <li key={a._id}>
                <button
                  type="button"
                  onClick={() => onSelect(a._id!)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    active ? "border-ink bg-neutral-50" : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  {/* Radio indicator - 18×18 for legible tap feedback */}
                  <span
                    className={cn(
                      "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-ink" : "border-neutral-300",
                    )}
                  >
                    {active ? <span className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
                  </span>
                  <div className="flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">{a.fullName}</span>
                      {a.isDefault ? <Badge variant="outline">Default</Badge> : null}
                      {a.label ? <span className="text-xs text-neutral-500">{a.label}</span> : null}
                    </div>
                    <div className="mt-0.5 text-neutral-600">{a.phone}</div>
                    <div className="text-neutral-600">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.district}
                      {a.postalCode ? ` ${a.postalCode}` : ""}, {a.country ?? "BD"}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => onSelect("new")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm font-medium transition-colors",
                selectedId === "new" ? "border-ink bg-neutral-50 text-ink" : "border-neutral-300 text-neutral-600 hover:border-ink hover:text-ink",
              )}
            >
              <Plus className="h-[14px] w-[14px]" /> Use a new address
            </button>
          </li>
        </ul>
      ) : null}

      {(selectedId === "new" || addresses.length === 0) ? (
        <NewAddressForm form={form} showSaveToggle={addresses.length === 0 ? false : true} />
      ) : null}
    </section>
  );
}

interface NewAddressFormProps {
  form: ReturnType<typeof useForm<AddressFormValues>>;
  showSaveToggle: boolean;
}

function NewAddressForm({ form, showSaveToggle }: NewAddressFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
      <Field label="Full name" error={errors.fullName?.message} required>
        <Input {...register("fullName")} placeholder="Rahim Khan" />
      </Field>
      <Field label="Phone" error={errors.phone?.message} required>
        <Input {...register("phone")} placeholder="+8801XXXXXXXXX" inputMode="tel" />
      </Field>
      <Field label="Alternate phone" error={errors.altPhone?.message}>
        <Input {...register("altPhone")} placeholder="+8801XXXXXXXXX (optional)" inputMode="tel" />
      </Field>
      <Field label="Country">
        <Input value="Bangladesh" readOnly className="cursor-default bg-neutral-50 text-neutral-500" />
      </Field>
      <Field label="Address line 1" error={errors.line1?.message} required className="sm:col-span-2">
        <Input {...register("line1")} placeholder="House, road, area" />
      </Field>
      <Field label="Address line 2" error={errors.line2?.message} className="sm:col-span-2">
        <Input {...register("line2")} placeholder="Apt, floor (optional)" />
      </Field>
      <Field label="City" error={errors.city?.message} required>
        <Input {...register("city")} />
      </Field>
      <Field label="District" error={errors.district?.message} required>
        <Input {...register("district")} placeholder="Dhaka" />
      </Field>
      <Field label="Division" error={errors.division?.message}>
        <Input {...register("division")} />
      </Field>
      <Field label="Postal code" error={errors.postalCode?.message}>
        <Input {...register("postalCode")} />
      </Field>
      {showSaveToggle ? (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" {...register("saveAddress")} className="h-[16px] w-[16px] accent-ink" />
          Save this address to my address book
        </label>
      ) : null}
    </form>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, required, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <Label required={required}>{label}</Label>
      {children}
      {error ? <span className="text-xs text-ink">{error}</span> : null}
    </div>
  );
}

/* ───────────────────── Payment block ───────────────────── */

interface PaymentBlockProps {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
  enabledMethods?: string[];
}

function PaymentBlock({ value, onChange, enabledMethods }: PaymentBlockProps) {
  const options = React.useMemo(
    () =>
      enabledMethods && enabledMethods.length > 0
        ? PAYMENT_OPTIONS.filter((o) => enabledMethods.includes(o.id))
        : PAYMENT_OPTIONS,
    [enabledMethods],
  );

  // If the current selection was disabled by the admin, switch to first available.
  React.useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.id === value)) {
      onChange(options[0]!.id as PaymentMethod);
    }
  }, [options, value, onChange]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-paper p-4">
      <h2 className="text-base font-semibold text-ink">Payment</h2>
      <ul className="flex flex-col gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onChange(opt.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-ink bg-neutral-50" : "border-neutral-200 hover:border-neutral-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-ink" : "border-neutral-300",
                  )}
                >
                  {active ? <span className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
                </span>
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-ink">{opt.label}</div>
                  <div className="text-xs text-neutral-500">{opt.description}</div>
                </div>
                {active ? <CheckCircle2 className="h-[16px] w-[16px] shrink-0 text-ink" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-neutral-500">
        Mobile-banking and card payments redirect after placing your order. COD requires no online payment.
      </p>
    </section>
  );
}

/* ───────────────────── Order summary side card ───────────────────── */

interface OrderSummaryProps {
  cart: ServerCart;
  appliedCoupon: AppliedCoupon | null;
  couponError: { code: CartCouponRejectionCode; message: string } | null;
  subtotal: number;
  discount: number;
  shippingCost: number;
  freeThreshold: number;
  total: number;
  onPlaceOrder: () => void;
  isPlacing: boolean;
  onUpdateQty: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
}

function OrderSummary({
  cart,
  appliedCoupon,
  couponError,
  subtotal,
  discount,
  shippingCost,
  freeThreshold,
  total,
  onPlaceOrder,
  isPlacing,
  onUpdateQty,
  onRemove,
}: OrderSummaryProps) {
  const isFreeDelivery = freeThreshold > 0 && subtotal >= freeThreshold;
  return (
    <aside className="flex flex-col gap-3 self-start rounded-xl border border-neutral-200 bg-paper p-4 md:sticky md:top-20">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Order summary</h2>

      <ul className="flex flex-col divide-y divide-neutral-100">
        {cart.items.map((it) => (
          <li key={it._id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <div className="relative h-[44px] w-[44px] shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
              {it.image ? (
                <Image src={it.image} alt={it.title} fill sizes="44px" className="object-cover" />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium leading-snug text-ink">{it.title}</div>
                  {it.options && Object.keys(it.options).length > 0 ? (
                    <div className="mt-0.5 text-xs text-neutral-500 line-clamp-1">
                      {Object.entries(it.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(it._id)}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:text-accent"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => it.qty > 1 ? onUpdateQty(it._id, it.qty - 1) : onRemove(it._id)}
                    className="flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-[28px] select-none text-center text-sm font-medium text-ink">{it.qty}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(it._id, it.qty + 1)}
                    className="flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-ink">{formatPrice(it.price * it.qty, cart.currency)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 text-sm">
        <Row label="Subtotal" value={formatPrice(subtotal, cart.currency)} />
        {appliedCoupon ? (
          <Row
            label={`Coupon (${appliedCoupon.code})`}
            value={`−${formatPrice(discount, cart.currency)}`}
          />
        ) : cart.couponCode && couponError ? (
          <Row
            label={`Coupon (${cart.couponCode})`}
            value={couponError.message}
            muted
          />
        ) : null}
        {isFreeDelivery ? (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Shipping</span>
            <span className="font-semibold text-green-700">FREE</span>
          </div>
        ) : (
          <Row label="Shipping" value={formatPrice(shippingCost, cart.currency)} />
        )}
      </div>

      <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-bold text-ink">
        <span>Total</span>
        <span>{formatPrice(total, cart.currency)}</span>
      </div>

      <Button onClick={onPlaceOrder} loading={isPlacing} size="md" fullWidth>
        <Lock className="h-[14px] w-[14px]" />
        <span className="ml-1.5">Place order</span>
      </Button>
      <p className="text-center text-xs text-neutral-500">
        By placing your order you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2">terms</Link>.
      </p>
    </aside>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-600">{label}</span>
      <span className={muted ? "text-neutral-500" : ""}>{value}</span>
    </div>
  );
}

/* ───────────────────── helpers ───────────────────── */

function estimateShipping(
  district?: string,
  subtotal = 0,
  delivery?: { insideDhaka?: number; outsideDhaka?: number; freeShippingThreshold?: number },
): number {
  const threshold = delivery?.freeShippingThreshold ?? 0;
  if (threshold > 0 && subtotal >= threshold) return 0;
  const isDhaka = district?.trim().toLowerCase() === "dhaka";
  return isDhaka ? (delivery?.insideDhaka ?? 80) : (delivery?.outsideDhaka ?? 130);
}

function getDistrictFromSelection(
  addresses: Address[] | undefined,
  selectedId: string | "new" | null,
  fallback?: string,
): string | undefined {
  if (selectedId && selectedId !== "new" && addresses) {
    return addresses.find((a) => a._id === selectedId)?.district;
  }
  return fallback;
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Minus,
  Package,
  Pencil,
  Percent,
  Plus,
  Receipt,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  User as UserIcon,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar, Badge, Button, Input } from "@/components/ui";
import { AdminInlineSkeleton, AdminProductGridSkeleton } from "@/components/admin/Skeleton";
import { Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/uiStore";
import { useUsbScanner } from "@/hooks/useUsbScanner";
import { BarcodeScanner } from "@/components/barcodes/BarcodeScanner";
import {
  useAdminProducts,
  useAdminUsers,
  useCreatePosOrder,
} from "@/hooks/useAdmin";
import { usePublicCustomizations } from "@/hooks/useCustomizations";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";
import {
  CustomizationFields,
  customizationAddOns,
  customizationOptions,
  draftFromOptions,
  isCustomizationKey,
  useCustomizationAssignment,
  type CustomizationDraft,
} from "@/components/admin/CustomizationEditor";
import { AdminError } from "@/lib/api/admin";
import { catalogApi } from "@/lib/api/catalog";
import type {
  AdminCreatePosOrderInput,
  AdminManualDiscountInput,
  AdminPosOrderItemInput,
  AdminProductSort,
  AdminProductSummary,
} from "@/types/admin";
import type { AddressInput, PaymentMethod } from "@/types/commerce";
import type { ProductDetail } from "@/types/catalog";

/* -- Constants -- */

const PAYMENT_OPTIONS: Array<{ id: PaymentMethod; label: string; cashLike: boolean }> = [
  { id: "cod", label: "Cash on delivery", cashLike: true },
  { id: "bkash", label: "bKash", cashLike: false },
  { id: "nagad", label: "Nagad", cashLike: false },
  { id: "rocket", label: "Rocket", cashLike: false },
  { id: "sslcommerz", label: "SSLCommerz", cashLike: false },
  { id: "stripe", label: "Stripe", cashLike: false },
  { id: "paypal", label: "PayPal", cashLike: false },
  { id: "card", label: "Card (direct)", cashLike: false },
  { id: "bank_transfer", label: "Bank transfer", cashLike: false },
];

const SORT_OPTIONS: Array<{ value: AdminProductSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-desc", label: "Price: high → low" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "stock-desc", label: "Stock: high → low" },
  { value: "stock-asc", label: "Stock: low → high" },
];

/* -- Cart state -- */

interface PosLineAddOn {
  label: string;
  amount: number;
}

interface PosCartLine {
  lineKey: string;
  productId: string;
  variantId?: string;
  options?: Record<string, string>;
  qty: number;
  /** Final unit price INCLUDING customization add-ons. */
  unitPrice: number;
  /** Unit price before add-ons - only set on customized lines. */
  basePrice?: number;
  /** Per-unit customization charges included in `unitPrice`. */
  addOns?: PosLineAddOn[];
  /** Manual per-line discount, applied to the product/variant price only (not add-ons). */
  discount?: AdminManualDiscountInput;
  title: string;
  image?: string;
  sku?: string;
  /** Product slug - lets the cart re-open the configurator to edit a line. */
  slug?: string;
}

function makeLineKey(
  productId: string,
  variantId?: string,
  options?: Record<string, string>,
): string {
  // Personalisation (Name/Number/Patches) lives in options - hash it in so
  // the same variant with different personalisation stays a separate row.
  const optionsHash =
    options && Object.keys(options).length > 0
      ? Object.keys(options)
          .sort()
          .map((k) => `${k}=${options[k]}`)
          .join("|")
      : "";
  const base = variantId ? `${productId}::${variantId}` : productId;
  return optionsHash ? `${base}::${optionsHash}` : base;
}

/* -- Money helpers -- */

function formatMoney(amount: number): string {
  return `Tk ${amount.toLocaleString("en-IN")}`;
}

/**
 * Resolves a manual discount against a base amount - mirrors the backend's
 * clamping exactly (percentage capped implicitly by the 0-100 input range,
 * fixed capped at `base` so a line/order can never price below zero) so the
 * POS preview always matches what the server will actually charge.
 */
function discountAmount(base: number, discount?: AdminManualDiscountInput | null): number {
  if (!discount || !discount.value) return 0;
  const raw = discount.type === "percentage" ? (base * discount.value) / 100 : discount.value;
  return Math.min(Math.max(0, raw), base);
}

/**
 * Mirrors the server's site-settings-driven shipping calc (resolveShipping)
 * so the POS preview matches what the storefront checkout - and the final
 * order - will charge.
 */
function estimateShipping(
  district: string,
  subtotal: number,
  delivery?: { insideDhaka?: number; outsideDhaka?: number; freeShippingThreshold?: number },
): number {
  if (!district) return 0;
  const threshold = delivery?.freeShippingThreshold ?? 0;
  if (threshold > 0 && subtotal >= threshold) return 0;
  return district.trim().toLowerCase() === "dhaka"
    ? (delivery?.insideDhaka ?? 80)
    : (delivery?.outsideDhaka ?? 130);
}

/* -- Discount editor --
 * Shared between the per-line configurator and the order-wide summary card:
 * a collapsed "Add discount" trigger that expands into a %/Tk toggle + a
 * number input, and reports the resolved currency amount as `previewAmount`
 * so both callers can show "-Tk N" without duplicating the clamp math. */

interface DiscountEditorProps {
  label: string;
  value: AdminManualDiscountInput | null;
  onChange: (v: AdminManualDiscountInput | null) => void;
  previewAmount?: number;
}

function DiscountEditor({ label, value, onChange, previewAmount }: DiscountEditorProps) {
  const [open, setOpen] = React.useState(Boolean(value));

  if (!open && !value) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#1A56DB] hover:underline"
      >
        <Percent className="h-[14px] w-[14px]" aria-hidden />
        {label}
      </button>
    );
  }

  const type = value?.type ?? "percentage";
  const rawValue = value?.value ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      <div className="inline-flex h-[32px] items-center rounded-[8px] border border-gray-200 bg-white p-[2px] text-[12px] shadow-sm">
        <button
          type="button"
          onClick={() => onChange({ type: "percentage", value: Math.min(rawValue, 100) })}
          className={cn(
            "rounded-[6px] px-[10px] py-[4px] font-medium transition duration-75",
            type === "percentage" ? "bg-[#1A56DB] text-white" : "text-gray-500 hover:text-gray-900",
          )}
        >
          %
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: "fixed", value: rawValue })}
          className={cn(
            "rounded-[6px] px-[10px] py-[4px] font-medium transition duration-75",
            type === "fixed" ? "bg-[#1A56DB] text-white" : "text-gray-500 hover:text-gray-900",
          )}
        >
          Tk
        </button>
      </div>
      <input
        type="number"
        min={0}
        max={type === "percentage" ? 100 : undefined}
        value={rawValue || ""}
        onChange={(e) => {
          const next = Math.max(0, Number(e.target.value) || 0);
          onChange({ type, value: type === "percentage" ? Math.min(next, 100) : next });
        }}
        placeholder="0"
        aria-label={label}
        className="h-[32px] w-[80px] rounded-[8px] border border-gray-300 bg-gray-50 px-[8px] text-[13px] font-medium tabular-nums text-gray-900 focus:border-[#1A56DB] focus:bg-white focus:outline-none"
      />
      {previewAmount ? (
        <span className="text-[12px] font-medium tabular-nums text-red-600">
          -{formatMoney(previewAmount)}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={`Remove ${label.toLowerCase()}`}
        onClick={() => {
          onChange(null);
          setOpen(false);
        }}
        className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-red-100 hover:text-red-600"
      >
        <X className="h-[14px] w-[14px]" aria-hidden />
      </button>
    </div>
  );
}

/* -- Product picker -- */

interface ProductPickerProps {
  onAdd: (line: PosCartLine) => void;
}

function ProductPicker({ onAdd }: ProductPickerProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [cameraOpen, setCameraOpen] = React.useState(false);

  // USB / Bluetooth keyboard-wedge scanner; fires when barcode is scanned
  useUsbScanner({
    onScan: (code) => setSearch(code),
  });
  const [sort, setSort] = React.useState<AdminProductSort>("newest");
  const [status, setStatus] = React.useState<"active" | "all">("active");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  React.useEffect(() => setPage(1), [debouncedSearch, sort, status]);

  const params = React.useMemo(
    () => ({ q: debouncedSearch || undefined, sort, status, limit: 12, page }),
    [debouncedSearch, sort, status, page],
  );

  const { data, isLoading, isFetching } = useAdminProducts(params);
  const products = data?.data?.products ?? [];
  const meta = data?.meta;

  const [selected, setSelected] = React.useState<AdminProductSummary | null>(null);

  return (
    <section className="flex flex-col gap-[16px]">
      {/* Search + filters - Flowbite table toolbar, matching the orders page:
          search field with inset icons on the left, labeled selects on the
          right, all on a 40px control height inside one card. */}
      <header className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="pos-search" className="sr-only">
            Search products
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
            <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
          </div>
          <Input
            id="pos-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or SKU — or scan a barcode…"
            className="pl-[36px] pr-[104px]"
          />
          {/* Inset controls - clear, camera scan, USB scanner indicator */}
          <div className="absolute inset-y-0 right-0 flex items-center gap-[4px] pr-[8px]">
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-[16px] w-[16px]" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              title="Scan barcode with camera"
              aria-label="Open camera scanner"
              onClick={() => setCameraOpen(true)}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <Camera className="h-[16px] w-[16px]" aria-hidden />
            </button>
            <span title="USB scanner active" className="flex shrink-0 items-center">
              <ScanLine className="h-[16px] w-[16px] text-gray-300" aria-hidden />
            </span>
          </div>
        </div>

        <BarcodeScanner
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={(code) => { setSearch(code); setCameraOpen(false); }}
          prompt="Point camera at product barcode to search"
        />

        <div className="flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0">
          <div className="flex flex-1 items-center gap-[8px] sm:flex-none">
            <label htmlFor="pos-status" className="w-[44px] shrink-0 text-[13px] font-medium text-gray-500 sm:w-auto">
              Status
            </label>
            <Select
              id="pos-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              options={[
                { value: "active", label: "Active only" },
                { value: "all", label: "All products" },
              ]}
              containerClassName="flex-1 sm:w-36 sm:flex-none"
            />
          </div>
          <div className="flex flex-1 items-center gap-[8px] sm:flex-none">
            <label htmlFor="pos-sort" className="w-[44px] shrink-0 text-[13px] font-medium text-gray-500 sm:w-auto">
              Sort
            </label>
            <Select
              id="pos-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as AdminProductSort)}
              options={SORT_OPTIONS}
              containerClassName="flex-1 sm:w-44 sm:flex-none"
            />
          </div>
        </div>
      </header>

      {selected ? (
        <ProductConfigurator
          summary={selected}
          onClose={() => setSelected(null)}
          onConfirm={(line) => {
            onAdd(line);
            setSelected(null);
          }}
        />
      ) : null}

      {isLoading ? (
        <AdminProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-300 p-6 text-center">
          <Package className="h-5 w-5 text-neutral-400" aria-hidden />
          <p className="text-sm text-neutral-600">
            {debouncedSearch
              ? `No products match "${debouncedSearch}"`
              : "No products to show"}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-[16px] sm:grid-cols-3 lg:grid-cols-4",
            isFetching && "opacity-70",
          )}
        >
          {products.map((p) => (
            <ProductCard key={p._id} product={p} onSelect={() => setSelected(p)} />
          ))}
        </div>
      )}

      {meta && meta.totalPages && meta.totalPages > 1 ? (
        <footer className="flex items-center justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-600">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} products
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= (meta.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}

interface ProductCardProps {
  product: AdminProductSummary;
  onSelect: () => void;
}

/* Flowbite e-commerce product card: white shadow-sm card, padded image,
 * semibold title, hero price bottom-left, primary blue action button. The
 * whole card is one <button> (the POS flow opens the configurator wherever
 * you click), so the "Add to cart" pill is a styled span, not a nested
 * button. */
function ProductCard({ product, onSelect }: ProductCardProps) {
  const oos = product.stock <= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col rounded-[8px] border border-gray-200 bg-white p-[12px] text-left shadow-sm",
        "transition duration-150 hover:shadow-md",
        !product.isActive && "opacity-70",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[8px] bg-gray-50">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <Package className="h-[24px] w-[24px]" aria-hidden />
          </div>
        )}
        {!product.isActive ? (
          <span className="absolute right-[8px] top-[8px] rounded-[4px] bg-gray-100 px-[10px] py-[2px] text-[12px] font-medium text-gray-800">
            Hidden
          </span>
        ) : null}
      </div>

      <h3 className="mt-[12px] text-[14px] font-semibold leading-snug text-gray-900 line-clamp-2">
        {product.title}
      </h3>

      <div className="mt-[8px] flex flex-1 items-end justify-between gap-[8px]">
        <span className="text-[18px] font-bold leading-none tabular-nums text-gray-900">
          {formatMoney(product.price)}
        </span>
        <span className={cn("text-[12px]", oos ? "font-medium text-red-600" : "text-gray-500")}>
          {oos ? "Out of stock" : `${product.stock} in stock`}
        </span>
      </div>

      <span
        className={cn(
          "mt-[12px] inline-flex h-[36px] w-full items-center justify-center gap-[8px] rounded-[8px] text-[13px] font-medium transition duration-75",
          oos
            ? "bg-gray-100 text-gray-400"
            : "bg-[#1A56DB] text-white group-hover:bg-[#1E429F]",
        )}
      >
        <ShoppingCart className="h-[16px] w-[16px]" aria-hidden />
        {oos ? "Out of stock" : "Add to cart"}
      </span>
    </button>
  );
}

/* -- Product configurator -- */

interface ProductConfiguratorProps {
  summary: AdminProductSummary;
  onClose: () => void;
  onConfirm: (line: PosCartLine) => void;
  /** When editing an existing cart line - prefills variant/customization/qty. */
  initial?: PosCartLine;
}

function ProductConfigurator({ summary, onClose, onConfirm, initial }: ProductConfiguratorProps) {
  const [detail, setDetail] = React.useState<ProductDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    catalogApi
      .getProduct(summary.slug)
      .then((p) => { if (!cancelled) setDetail(p); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load product"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [summary.slug]);

  const axes = React.useMemo(() => {
    if (!detail?.variants?.length) return [] as string[];
    const seen = new Set<string>();
    for (const v of detail.variants) {
      for (const key of Object.keys(v.options ?? {})) seen.add(key);
    }
    return Array.from(seen);
  }, [detail]);

  const firstInStock = React.useMemo(
    () =>
      detail?.variants?.find((v) => (v.isActive ?? true) && v.stock > 0) ??
      detail?.variants?.[0],
    [detail],
  );

  const [selection, setSelection] = React.useState<Record<string, string>>({});
  const [qty, setQty] = React.useState(initial?.qty ?? 1);

  React.useEffect(() => {
    // Editing an existing line: seed the variant axes from its options.
    const variantSel: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial?.options ?? {})) {
      if (!isCustomizationKey(k)) variantSel[k] = v;
    }
    if (Object.keys(variantSel).length > 0) {
      setSelection(variantSel);
      return;
    }
    if (firstInStock?.options) setSelection({ ...firstInStock.options });
  }, [firstInStock, initial]);

  const matchedVariant = React.useMemo(() => {
    if (!detail?.variants?.length) return null;
    return (
      detail.variants.find((v) => {
        const opts = v.options ?? {};
        return axes.every((k) => opts[k] === selection[k]);
      }) ?? null
    );
  }, [detail, axes, selection]);

  /* ── Customization (placement / name / number / patches) ──
   * Same assignment-matching + option encoding as the storefront PDP
   * ("Print" / "Name" / "Number" / "Patches" option keys) - the server
   * re-prices the add-ons authoritatively via priceCustomizations, so this
   * preview only has to agree with the config, not own it. Lets the cashier
   * ring up customised orders taken over social media or in the shop. */
  const { data: customizationConfig } = usePublicCustomizations();
  const { assignment, patchChoices, allowName, allowNumber } =
    useCustomizationAssignment(customizationConfig, detail);
  const [custom, setCustom] = React.useState<CustomizationDraft>(() =>
    draftFromOptions(initial?.options),
  );
  const [discount, setDiscount] = React.useState<AdminManualDiscountInput | null>(
    initial?.discount ?? null,
  );
  React.useEffect(() => {
    setCustom(draftFromOptions(initial?.options));
    setQty(initial?.qty ?? 1);
    setDiscount(initial?.discount ?? null);
  }, [detail?._id, initial]);

  const addOns: PosLineAddOn[] = customizationAddOns(
    custom,
    customizationConfig,
    allowName,
    allowNumber,
    patchChoices,
  );
  const addOnTotal = addOns.reduce((s, a) => s + a.amount, 0);

  const baseUnitPrice = matchedVariant?.price ?? detail?.price ?? summary.price;
  const lineDiscountAmount = discountAmount(baseUnitPrice, discount);
  const unitPrice = baseUnitPrice - lineDiscountAmount + addOnTotal;
  const stock = matchedVariant?.stock ?? detail?.stock ?? summary.stock;
  const trackStock = detail?.trackStock ?? true;
  const overStock = trackStock && qty > stock;

  const handleAdd = () => {
    if (!detail) return;
    if (axes.length > 0 && !matchedVariant) return;
    // Merge the variant selection with the personalisation keys - the same
    // encoding the storefront writes, so the server prices them identically.
    const options: Record<string, string> = {
      ...(matchedVariant?.options ?? {}),
      ...customizationOptions(custom, allowName, allowNumber, patchChoices),
    };
    onConfirm({
      lineKey: makeLineKey(detail._id, matchedVariant?._id, options),
      productId: detail._id,
      variantId: matchedVariant?._id,
      options: Object.keys(options).length > 0 ? options : undefined,
      qty,
      unitPrice,
      basePrice: addOns.length > 0 ? baseUnitPrice - lineDiscountAmount : undefined,
      addOns: addOns.length > 0 ? addOns : undefined,
      discount: discount ?? undefined,
      title: detail.title,
      image: detail.images?.[0]?.url ?? summary.image,
      sku: matchedVariant?.sku,
      slug: detail.slug ?? summary.slug,
    });
  };

  /* Flowbite product-quickview layout: image on the left; title, hero price,
   * a divider, option selects + joined qty stepper, another divider, and the
   * primary blue action on the right. Stepper corners and the middle input
   * use inline borderRadius because the admin CSS skin rounds every control
   * to 8px, which would break the joined group. */
  return (
    <div className="relative w-full rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <button
        type="button"
        aria-label="Close picker"
        onClick={onClose}
        className="absolute right-[16px] top-[16px] flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
      >
        <X className="h-[16px] w-[16px]" aria-hidden />
      </button>

      {loading ? (
        <AdminInlineSkeleton rows={3} className="pr-[40px]" />
      ) : error ? (
        <div className="flex items-center gap-[8px] pr-[40px] text-[13px] text-red-600">
          <AlertTriangle className="h-[16px] w-[16px]" aria-hidden /> {error}
        </div>
      ) : detail ? (
        <div className="flex flex-col gap-[16px] sm:flex-row sm:gap-[24px]">
          {/* Product image - fills the card's full height on the left */}
          <div className="h-[200px] w-full overflow-hidden rounded-[8px] border border-gray-100 bg-gray-50 sm:h-auto sm:w-[260px] sm:shrink-0 sm:self-stretch lg:w-[320px]">
            {summary.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300">
                <Package className="h-[24px] w-[24px]" aria-hidden />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <h3 className="pr-[40px] text-[20px] font-bold leading-tight text-gray-900">
              {summary.title}
            </h3>
            <div className="mt-[8px] flex flex-wrap items-baseline gap-[8px]">
              {lineDiscountAmount > 0 ? (
                <span className="text-[16px] text-gray-400 line-through">
                  {formatMoney(baseUnitPrice + addOnTotal)}
                </span>
              ) : null}
              <span className="text-[24px] font-bold leading-none tabular-nums text-gray-900">
                {formatMoney(unitPrice)}
              </span>
              {trackStock ? (
                <span className="text-[14px] text-gray-500">({stock} available)</span>
              ) : null}
            </div>

            {/* Discount - manual, per line (percentage or fixed amount) */}
            <div className="mt-[16px] border-t border-gray-200 pt-[16px]">
              <p className="mb-[8px] text-[14px] font-semibold text-gray-900">
                Discount <span className="font-normal text-gray-400">(optional)</span>
              </p>
              <DiscountEditor
                label="Add discount"
                value={discount}
                onChange={setDiscount}
                previewAmount={lineDiscountAmount}
              />
            </div>

            {/* Options + quantity */}
            <div className="mt-[16px] border-t border-gray-200 pt-[16px]">
              <div className="flex flex-wrap items-end gap-x-[24px] gap-y-[16px]">
                {axes.map((axis) => {
                  const values = Array.from(
                    new Set(
                      (detail.variants ?? [])
                        .map((v) => v.options?.[axis])
                        .filter((x): x is string => typeof x === "string"),
                    ),
                  );
                  return (
                    <div key={axis}>
                      <label
                        htmlFor={`pos-axis-${axis}`}
                        className="mb-[8px] block text-[14px] font-semibold capitalize text-gray-900"
                      >
                        {axis}
                      </label>
                      <Select
                        id={`pos-axis-${axis}`}
                        value={selection[axis] ?? ""}
                        onChange={(e) =>
                          setSelection((prev) => ({ ...prev, [axis]: e.target.value }))
                        }
                        options={values.map((v) => ({ value: v, label: v }))}
                        containerClassName="w-40"
                      />
                    </div>
                  );
                })}

                {/* Flowbite joined quantity stepper */}
                <div>
                  <span className="mb-[8px] block text-[14px] font-semibold text-gray-900">
                    Qty:
                  </span>
                  <div className="inline-flex h-[40px]">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="Decrement quantity"
                      style={{ borderRadius: "8px 0 0 8px" }}
                      className="flex h-[40px] w-[40px] items-center justify-center border border-gray-300 bg-gray-100 text-gray-600 transition duration-75 hover:bg-gray-200 hover:text-gray-900"
                    >
                      <Minus className="h-[16px] w-[16px]" aria-hidden />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={qty}
                      onChange={(e) =>
                        setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                      }
                      aria-label="Quantity"
                      style={{ borderRadius: 0 }}
                      className="h-[40px] w-[56px] border-y border-gray-300 bg-gray-50 text-center text-[14px] font-medium text-gray-900 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(99, q + 1))}
                      aria-label="Increment quantity"
                      style={{ borderRadius: "0 8px 8px 0" }}
                      className="flex h-[40px] w-[40px] items-center justify-center border border-gray-300 bg-gray-100 text-gray-600 transition duration-75 hover:bg-gray-200 hover:text-gray-900"
                    >
                      <Plus className="h-[16px] w-[16px]" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Customization - only for products with a matching assignment */}
            {assignment && (allowName || allowNumber || patchChoices.length > 0) ? (
              <div className="mt-[16px] border-t border-gray-200 pt-[16px]">
                <p className="mb-[8px] text-[14px] font-semibold text-gray-900">
                  Customization <span className="font-normal text-gray-400">(optional)</span>
                </p>
                <CustomizationFields
                  draft={custom}
                  onChange={setCustom}
                  config={customizationConfig}
                  allowName={allowName}
                  allowNumber={allowNumber}
                  patchChoices={patchChoices}
                />
              </div>
            ) : null}

            {/* Action */}
            <div className="mt-[16px] border-t border-gray-200 pt-[16px]">
              <button
                type="button"
                onClick={handleAdd}
                disabled={
                  (axes.length > 0 && !matchedVariant) ||
                  overStock ||
                  (trackStock && stock <= 0)
                }
                className="inline-flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[24px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart className="h-[16px] w-[16px]" aria-hidden />
                {initial ? "Update line" : "Add to order"}
              </button>

              {overStock ? (
                <p className="mt-[8px] text-[13px] font-medium text-red-600">
                  Only {stock} in stock for this variant.
                </p>
              ) : null}
              {axes.length > 0 && !matchedVariant ? (
                <p className="mt-[8px] text-[13px] font-medium text-red-600">
                  That option combination isn&apos;t available.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -- Cart panel -- */

interface CartPanelProps {
  lines: PosCartLine[];
  onIncrement: (lineKey: string) => void;
  onDecrement: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
  onEdit: (line: PosCartLine) => void;
}

function CartPanel({ lines, onIncrement, onDecrement, onRemove, onEdit }: CartPanelProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 p-[32px] text-center">
        <ShoppingCart className="h-[24px] w-[24px] text-gray-300" aria-hidden />
        <p className="text-[14px] text-gray-500">No items yet — search and add products on the left.</p>
      </div>
    );
  }
  /* Flowbite cart line: thumbnail left; title with a red trash icon button
   * on its right; option badges + SKU + unit price; bottom row pairs the
   * joined qty stepper with the bold line total. Stepper corners are inline
   * for the same reason as the configurator's. */
  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {lines.map((line) => (
        <li key={line.lineKey} className="flex gap-[12px] py-[12px] first:pt-0 last:pb-0">
          {/* Thumbnail - stretches the full height of the line */}
          <div className="w-[88px] shrink-0 self-stretch overflow-hidden rounded-[8px] border border-gray-100 bg-gray-50">
            {line.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={line.image} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-[20px] w-[20px] text-gray-300" aria-hidden />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <div className="flex items-start justify-between gap-[8px]">
              <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-900">
                {line.title}
              </span>
              <span className="flex shrink-0 items-center gap-[2px]">
                {line.slug ? (
                  <button
                    type="button"
                    aria-label="Edit line"
                    title="Edit options / customization"
                    onClick={() => onEdit(line)}
                    className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-[#1A56DB]"
                  >
                    <Pencil className="h-[14px] w-[14px]" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Remove item"
                  title="Remove"
                  onClick={() => onRemove(line.lineKey)}
                  className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-red-100 hover:text-red-600"
                >
                  <Trash2 className="h-[16px] w-[16px]" aria-hidden />
                </button>
              </span>
            </div>

            {line.options && Object.keys(line.options).length > 0 ? (
              <div className="flex flex-wrap gap-[4px]">
                {Object.entries(line.options).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center rounded-[4px] bg-gray-100 px-[8px] py-[2px] text-[11px] text-gray-500"
                  >
                    {k}:<strong className="ml-[4px] font-semibold text-gray-900">{v}</strong>
                  </span>
                ))}
              </div>
            ) : null}

            {line.sku ? (
              <span className="truncate font-mono text-[10px] text-gray-400">
                SKU: {line.sku}
              </span>
            ) : null}

            {line.discount ? (
              <span className="inline-flex w-fit items-center gap-[4px] rounded-[4px] bg-red-50 px-[6px] py-[1px] text-[11px] font-medium text-red-600">
                <Percent className="h-[10px] w-[10px]" aria-hidden />
                {line.discount.type === "percentage"
                  ? `${line.discount.value}% off`
                  : `${formatMoney(line.discount.value)} off`}
              </span>
            ) : null}

            <span className="text-[12px] tabular-nums text-gray-500">
              {formatMoney(line.unitPrice)} each
            </span>

            {/* Stepper + line total */}
            <div className="mt-[4px] flex items-center justify-between gap-[8px]">
              <div className="inline-flex h-[32px]">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => onDecrement(line.lineKey)}
                  style={{ borderRadius: "8px 0 0 8px" }}
                  className="flex h-[32px] w-[32px] items-center justify-center border border-gray-300 bg-gray-100 text-gray-600 transition duration-75 hover:bg-gray-200 hover:text-gray-900"
                >
                  <Minus className="h-[14px] w-[14px]" aria-hidden />
                </button>
                <span className="flex h-[32px] w-[36px] select-none items-center justify-center border-y border-gray-300 bg-gray-50 text-[13px] font-semibold tabular-nums text-gray-900">
                  {line.qty}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => onIncrement(line.lineKey)}
                  style={{ borderRadius: "0 8px 8px 0" }}
                  className="flex h-[32px] w-[32px] items-center justify-center border border-gray-300 bg-gray-100 text-gray-600 transition duration-75 hover:bg-gray-200 hover:text-gray-900"
                >
                  <Plus className="h-[14px] w-[14px]" aria-hidden />
                </button>
              </div>
              <span className="text-[14px] font-bold tabular-nums text-gray-900">
                {formatMoney(line.qty * line.unitPrice)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -- Customer block -- */

interface CustomerBlockProps {
  mode: "walkin" | "existing";
  setMode: (m: "walkin" | "existing") => void;
  walkin: { name: string; email: string; phone: string };
  setWalkin: React.Dispatch<
    React.SetStateAction<{ name: string; email: string; phone: string }>
  >;
  existingUserId: string | null;
  setExistingUserId: (id: string | null) => void;
}

function CustomerBlock({
  mode,
  setMode,
  walkin,
  setWalkin,
  existingUserId,
  setExistingUserId,
}: CustomerBlockProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: userData, isFetching: usersLoading } = useAdminUsers(
    mode === "existing" && debouncedSearch.length >= 2
      ? { q: debouncedSearch, limit: 8 }
      : { limit: 0 },
  );
  const users = mode === "existing" ? userData?.data?.users ?? [] : [];
  const selectedUser = users.find((u) => u._id === existingUserId);

  return (
    <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <header className="flex items-center justify-between gap-[8px]">
        <h2 className="flex items-center gap-[8px] text-[18px] font-semibold text-gray-900">
          <UserIcon className="h-[18px] w-[18px] text-gray-400" aria-hidden /> Customer
        </h2>
        <div className="inline-flex items-center rounded-[8px] border border-gray-200 bg-white p-[2px] text-[13px] shadow-sm">
          <button
            type="button"
            onClick={() => setMode("walkin")}
            className={cn(
              "flex items-center gap-[6px] rounded-[6px] px-[12px] py-[6px] font-medium transition duration-75",
              mode === "walkin"
                ? "bg-[#1A56DB] text-white"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            <UserPlus className="h-[14px] w-[14px]" aria-hidden /> Walk-in
          </button>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={cn(
              "flex items-center gap-[6px] rounded-[6px] px-[12px] py-[6px] font-medium transition duration-75",
              mode === "existing"
                ? "bg-[#1A56DB] text-white"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            <UserIcon className="h-[14px] w-[14px]" aria-hidden /> Existing
          </button>
        </div>
      </header>

      {mode === "walkin" ? (
        <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Name *
            <Input
              value={walkin.name}
              onChange={(e) => setWalkin((s) => ({ ...s, name: e.target.value }))}
              placeholder="Customer name"
            />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Phone *
            <Input
              value={walkin.phone}
              onChange={(e) => setWalkin((s) => ({ ...s, phone: e.target.value }))}
              placeholder="01XXXXXXXXX"
            />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900 sm:col-span-2">
            Email (optional)
            <Input
              type="email"
              value={walkin.email}
              onChange={(e) => setWalkin((s) => ({ ...s, email: e.target.value }))}
              placeholder="receipt@example.com"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone…"
              className="pl-[36px]"
            />
          </div>
          {selectedUser ? (
            <div className="flex items-start gap-[12px] rounded-[8px] border border-gray-200 bg-gray-50 p-[12px]">
              <Avatar src={selectedUser.avatar} alt={selectedUser.name} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium text-gray-900">{selectedUser.name}</span>
                <span className="truncate text-[12px] text-gray-500">
                  {selectedUser.email}
                  {selectedUser.phone ? ` · ${selectedUser.phone}` : ""}
                </span>
              </div>
              <button
                type="button"
                aria-label="Clear selection"
                onClick={() => setExistingUserId(null)}
                className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-gray-200 hover:text-gray-900"
              >
                <X className="h-[16px] w-[16px]" aria-hidden />
              </button>
            </div>
          ) : usersLoading && debouncedSearch.length >= 2 ? (
            <AdminInlineSkeleton rows={2} className="rounded-[8px] border border-gray-200 p-[8px]" />
          ) : users.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded-[8px] border border-gray-200">
              {users.map((u) => (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setExistingUserId(u._id);
                      setSearch("");
                    }}
                    className="flex w-full items-start gap-[12px] border-b border-gray-100 p-[12px] text-left transition duration-75 last:border-b-0 hover:bg-gray-50"
                  >
                    <Avatar src={u.avatar} alt={u.name} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium text-gray-900">{u.name}</span>
                      <span className="truncate text-[12px] text-gray-500">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedSearch.length >= 2 ? (
            <p className="text-[13px] text-gray-500">
              No users match &ldquo;{debouncedSearch}&rdquo;.
            </p>
          ) : (
            <p className="text-[13px] text-gray-500">
              Type at least 2 characters to search the user directory.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* -- Shipping form -- */

interface ShippingFormProps {
  address: AddressInput;
  setAddress: React.Dispatch<React.SetStateAction<AddressInput>>;
}

function ShippingForm({ address, setAddress }: ShippingFormProps) {
  const upd = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((s) => ({ ...s, [k]: e.target.value }));

  const fieldLabel = "flex flex-col gap-[8px] text-[14px] font-medium text-gray-900";
  return (
    <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <h2 className="text-[18px] font-semibold text-gray-900">Delivery details</h2>
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <label className={cn(fieldLabel, "sm:col-span-2")}>
          Full name *
          <Input value={address.fullName} onChange={upd("fullName")} />
        </label>
        <label className={fieldLabel}>
          Phone *
          <Input value={address.phone} onChange={upd("phone")} />
        </label>
        <label className={fieldLabel}>
          Alt phone
          <Input value={address.altPhone ?? ""} onChange={upd("altPhone")} />
        </label>
        <label className={cn(fieldLabel, "sm:col-span-2")}>
          Address line 1 *
          <Input value={address.line1} onChange={upd("line1")} />
        </label>
        <label className={cn(fieldLabel, "sm:col-span-2")}>
          Address line 2
          <Input value={address.line2 ?? ""} onChange={upd("line2")} />
        </label>
        <label className={fieldLabel}>
          District *
          <Input value={address.district} onChange={upd("district")} />
        </label>
        <label className={fieldLabel}>
          Division
          <Input value={address.division ?? ""} onChange={upd("division")} />
        </label>
        <label className={fieldLabel}>
          Postal code
          <Input value={address.postalCode ?? ""} onChange={upd("postalCode")} />
        </label>
      </div>
    </section>
  );
}

/* -- Page -- */

const EMPTY_ADDRESS: AddressInput = {
  fullName: "",
  phone: "",
  line1: "",
  district: "",
  country: "BD",
};

export function PosClient() {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);

  const [lines, setLines] = React.useState<PosCartLine[]>([]);
  const [customerMode, setCustomerMode] = React.useState<"walkin" | "existing">("walkin");
  const [walkin, setWalkin] = React.useState({ name: "", email: "", phone: "" });
  const [existingUserId, setExistingUserId] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState<AddressInput>(EMPTY_ADDRESS);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cod");
  const [markPaid, setMarkPaid] = React.useState(true);
  const [transactionId, setTransactionId] = React.useState("");
  const [couponCode, setCouponCode] = React.useState("");
  const [orderDiscount, setOrderDiscount] = React.useState<AdminManualDiscountInput | null>(null);
  const [customerNote, setCustomerNote] = React.useState("");
  const [internalNotes, setInternalNotes] = React.useState("");

  const createOrder = useCreatePosOrder();
  const { data: publicSettings } = usePublicSiteSettings();

  React.useEffect(() => {
    const opt = PAYMENT_OPTIONS.find((p) => p.id === paymentMethod);
    setMarkPaid(opt?.cashLike ?? false);
  }, [paymentMethod]);

  React.useEffect(() => {
    if (customerMode !== "walkin") return;
    setAddress((s) => ({
      ...s,
      fullName: s.fullName || walkin.name,
      phone: s.phone || walkin.phone,
    }));
  }, [customerMode, walkin.name, walkin.phone]);

  const onAdd = (line: PosCartLine) => {
    setLines((prev) => {
      const idx = prev.findIndex((p) => p.lineKey === line.lineKey);
      if (idx === -1) return [...prev, line];
      const existing = prev[idx]!;
      const next = [...prev];
      next[idx] = { ...existing, qty: Math.min(99, existing.qty + line.qty) };
      return next;
    });
    toast({ title: `Added ${line.title}`, tone: "success" });
  };

  const onIncrement = (lineKey: string) =>
    setLines((prev) =>
      prev.map((l) => (l.lineKey === lineKey ? { ...l, qty: Math.min(99, l.qty + 1) } : l)),
    );
  const onDecrement = (lineKey: string) =>
    setLines((prev) =>
      prev
        .map((l) => (l.lineKey === lineKey ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  const onRemove = (lineKey: string) =>
    setLines((prev) => prev.filter((l) => l.lineKey !== lineKey));

  /* Editing an existing cart line re-opens the configurator (prefilled)
   * inside the Items card; confirming swaps the old line for the new one,
   * merging quantities if the result collides with another line. */
  const [editingLine, setEditingLine] = React.useState<PosCartLine | null>(null);
  const onReplaceLine = (oldKey: string, line: PosCartLine) => {
    setLines((prev) => {
      const without = prev.filter((l) => l.lineKey !== oldKey);
      const idx = without.findIndex((l) => l.lineKey === line.lineKey);
      if (idx === -1) return [...without, line];
      const next = [...without];
      const existing = next[idx]!;
      next[idx] = { ...line, qty: Math.min(99, existing.qty + line.qty) };
      return next;
    });
    setEditingLine(null);
    toast({ title: "Line updated", tone: "success" });
  };

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  /* Manual delivery-charge override. "" = automatic (settings-based
   * estimate); any typed value - including 0 - is sent to the server as-is,
   * covering pickups, negotiated couriers, and social-media arrangements. */
  const [manualShipping, setManualShipping] = React.useState("");
  const shippingOverridden = manualShipping !== "";
  const autoShipping = estimateShipping(address.district, subtotal, publicSettings?.delivery);
  const shippingPreview = shippingOverridden
    ? Math.max(0, Number(manualShipping) || 0)
    : autoShipping;
  const orderDiscountAmount = discountAmount(subtotal, orderDiscount);
  const totalPreview = subtotal + shippingPreview - orderDiscountAmount;

  const validationError = (() => {
    if (lines.length === 0) return "Add at least one product";
    if (customerMode === "walkin") {
      if (!walkin.name.trim()) return "Walk-in: customer name required";
      if (!walkin.phone.trim()) return "Walk-in: customer phone required";
    } else {
      if (!existingUserId) return "Pick an existing customer";
    }
    if (!address.fullName.trim()) return "Shipping: full name required";
    if (!address.phone.trim()) return "Shipping: phone required";
    if (!address.line1.trim()) return "Shipping: address required";
    if (!address.district.trim()) return "Shipping: district required";
    return null;
  })();

  const onSubmit = async () => {
    if (validationError) {
      toast({ title: validationError, tone: "error" });
      return;
    }

    const items: AdminPosOrderItemInput[] = lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      qty: l.qty,
      options: l.options,
      discount: l.discount,
    }));

    const body: AdminCreatePosOrderInput = {
      shippingAddress: address,
      items,
      paymentMethod,
      shippingCost: shippingOverridden ? shippingPreview : undefined,
      paymentStatus: markPaid ? "paid" : "pending",
      transactionId: transactionId.trim() || undefined,
      couponCode: couponCode.trim().toUpperCase() || undefined,
      orderDiscount: orderDiscount ?? undefined,
      customerNote: customerNote.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
    };

    if (customerMode === "existing") {
      body.user = existingUserId ?? undefined;
    } else {
      body.customer = {
        name: walkin.name.trim(),
        phone: walkin.phone.trim(),
        email: walkin.email.trim() || undefined,
      };
    }

    try {
      const created = await createOrder.mutateAsync(body);
      toast({ title: `Order ${created.orderNumber} created`, tone: "success" });
      router.push(`/admin/orders/${created._id}/invoice`);
    } catch (err) {
      const message = err instanceof AdminError ? err.message : "Couldn't create the order";
      toast({ title: message, tone: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-[16px] pb-[76px] xl:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 sm:text-2xl">POS — New Order</h1>
          <p className="text-[13px] text-neutral-500 sm:text-sm">
            In-person or phone sale. Stock is decremented atomically and the order lands confirmed.
          </p>
        </div>
        <Badge variant="muted">
          <Receipt className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
          Admin-only
        </Badge>
      </header>

      {/* Two independent scroll areas on xl: each column is sticky and owns
          its overflow, so the wheel only moves the column under the cursor
          while the other stays in place. Below xl they stack and the page
          scrolls normally. 80px = topbar (64px) + main padding (16px). */}
      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[1fr_400px]">
        {/* LEFT: product catalog. Plain scroll container (not a card) - the
            ProductPicker renders its own toolbar card + product-card grid, so
            wrapping it in another card would double the padding. */}
        <div className="min-w-0 xl:sticky xl:top-0 xl:max-h-[calc(100vh-80px)] xl:overflow-y-auto xl:pr-[4px] [scrollbar-width:thin]">
          <ProductPicker onAdd={onAdd} />
        </div>

        {/* RIGHT: order builder */}
        <aside
          id="pos-cart"
          className="flex scroll-mt-[16px] flex-col gap-[16px] xl:sticky xl:top-0 xl:max-h-[calc(100vh-80px)] xl:overflow-y-auto [scrollbar-width:thin]"
        >
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <header className="flex items-center justify-between">
              <h2 className="flex items-center gap-[8px] text-[18px] font-semibold text-gray-900">
                <ShoppingCart className="h-[18px] w-[18px] text-gray-400" aria-hidden /> Items
              </h2>
              <span className="text-[13px] text-gray-500">
                {lines.length} line{lines.length === 1 ? "" : "s"}
              </span>
            </header>
            {editingLine ? (
              <ProductConfigurator
                key={editingLine.lineKey}
                summary={
                  {
                    _id: editingLine.productId,
                    slug: editingLine.slug ?? "",
                    title: editingLine.title,
                    image: editingLine.image,
                    price: editingLine.basePrice ?? editingLine.unitPrice,
                    stock: editingLine.qty,
                    isActive: true,
                  } as AdminProductSummary
                }
                initial={editingLine}
                onClose={() => setEditingLine(null)}
                onConfirm={(line) => onReplaceLine(editingLine.lineKey, line)}
              />
            ) : null}
            <CartPanel
              lines={lines}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
              onEdit={(line) => setEditingLine(line)}
            />
          </section>

          <CustomerBlock
            mode={customerMode}
            setMode={setCustomerMode}
            walkin={walkin}
            setWalkin={setWalkin}
            existingUserId={existingUserId}
            setExistingUserId={setExistingUserId}
          />

          <ShippingForm address={address} setAddress={setAddress} />

          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <h2 className="flex items-center gap-[8px] text-[18px] font-semibold text-gray-900">
              <Banknote className="h-[18px] w-[18px] text-gray-400" aria-hidden /> Payment
            </h2>

            {/* Flowbite payment radio cards */}
            <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
              {PAYMENT_OPTIONS.map((p) => {
                const active = paymentMethod === p.id;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-[12px] rounded-[8px] border p-[12px] transition duration-75",
                      active
                        ? "border-[#1A56DB] bg-blue-50"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    )}
                  >
                    <input
                      type="radio"
                      name="pos-payment-method"
                      checked={active}
                      onChange={() => setPaymentMethod(p.id)}
                      className="mt-[2px] h-[16px] w-[16px] shrink-0"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[14px] font-medium text-gray-900">{p.label}</span>
                      <span className="text-[12px] text-gray-500">
                        {p.cashLike ? "Collected in person" : "Record external payment"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <label className="flex items-center gap-[12px] text-[14px] font-medium text-gray-900">
              <input
                type="checkbox"
                className="h-[16px] w-[16px] rounded border-gray-300"
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
              />
              Mark as paid now
            </label>
            {markPaid ? (
              <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
                Transaction ID (optional)
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="bKash trx / receipt #"
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
              Coupon code (optional)
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="SUMMER10"
              />
            </label>
          </section>

          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <h2 className="text-[18px] font-semibold text-gray-900">Notes</h2>
            <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
              Customer-facing note
              <textarea
                className={textareaClass}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={2}
                placeholder="Visible on the invoice"
              />
            </label>
            <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
              Internal note (admin-only)
              <textarea
                className={textareaClass}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                placeholder="Won't appear on the invoice"
              />
            </label>
          </section>

          {/* Flowbite order-summary card: gray box with the totals, then the
              primary checkout action. */}
          <section className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <div className="rounded-[8px] bg-gray-50 p-[16px]">
              <h2 className="text-[18px] font-semibold text-gray-900">Order summary</h2>
              <dl className="mt-[16px] flex flex-col gap-[12px] text-[14px]">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {formatMoney(subtotal)}
                  </dd>
                </div>
                {/* Delivery charge - editable. Typing any value (including
                    0) overrides the automatic estimate; "Auto" restores it. */}
                <div className="flex items-center justify-between gap-[8px]">
                  <dt className="text-gray-500">
                    Delivery
                    <span className="ml-[4px] text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {shippingOverridden ? "manual" : "auto"}
                    </span>
                  </dt>
                  <dd className="flex items-center gap-[8px]">
                    {shippingOverridden ? (
                      <button
                        type="button"
                        onClick={() => setManualShipping("")}
                        title="Reset to the automatic delivery charge"
                        className="text-[12px] font-medium text-[#1A56DB] hover:underline"
                      >
                        Auto
                      </button>
                    ) : null}
                    <input
                      inputMode="numeric"
                      aria-label="Delivery charge"
                      value={shippingOverridden ? manualShipping : String(autoShipping)}
                      onChange={(e) => setManualShipping(e.target.value.replace(/[^0-9]/g, ""))}
                      className="h-[32px] w-[88px] rounded-[8px] border border-gray-300 bg-gray-50 px-[8px] text-right text-[14px] font-medium tabular-nums text-gray-900 focus:border-[#1A56DB] focus:bg-white focus:outline-none"
                    />
                  </dd>
                </div>
                {/* Order-wide manual discount - the cashier's own call
                    (loyalty, damaged item, negotiated price), independent
                    of the coupon field above. */}
                <div className="flex items-center justify-between gap-[8px]">
                  <dt className="text-gray-500">Discount</dt>
                  <dd>
                    <DiscountEditor
                      label="Add discount"
                      value={orderDiscount}
                      onChange={setOrderDiscount}
                      previewAmount={orderDiscountAmount}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-[12px]">
                  <dt className="text-[16px] font-bold text-gray-900">Total</dt>
                  <dd className="text-[16px] font-bold tabular-nums text-gray-900">
                    {formatMoney(totalPreview)}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="mt-[12px] text-[12px] text-gray-500">
              {shippingOverridden
                ? "Manual delivery charge will be used as-is; the server re-applies the coupon and discount."
                : "Server re-computes shipping and re-applies the coupon and discount — final total may differ slightly."}
            </p>
            <button
              type="button"
              onClick={onSubmit}
              disabled={Boolean(validationError) || createOrder.isPending}
              title={validationError ?? undefined}
              className="mt-[12px] inline-flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[24px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createOrder.isPending ? (
                <Loader2 className="h-[16px] w-[16px] animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-[16px] w-[16px]" aria-hidden />
              )}
              Place order &amp; print invoice
            </button>
          </section>
        </aside>
      </div>

      {/* Mobile-only floating cart bar - jumps straight down to the cart /
          checkout instead of making the cashier scroll past the whole
          catalog, same pattern as a native shopping app's cart pill. Native
          smooth-scroll (html { scroll-behavior: smooth } in globals.css)
          animates the jump. */}
      {lines.length > 0 ? (
        <a
          href="#pos-cart"
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-[12px] border-t border-gray-200 bg-white px-[16px] py-[12px] shadow-[0_-4px_16px_rgba(0,0,0,0.1)] xl:hidden"
        >
          <span className="flex min-w-0 items-center gap-[8px] text-[13px] font-medium text-gray-900">
            <ShoppingCart className="h-[18px] w-[18px] shrink-0 text-[#1A56DB]" aria-hidden />
            <span className="truncate">
              {lines.length} {lines.length === 1 ? "item" : "items"}
              <span className="mx-[6px] text-gray-300">·</span>
              <span className="font-bold tabular-nums">{formatMoney(totalPreview)}</span>
            </span>
          </span>
          <span className="inline-flex h-[36px] shrink-0 items-center gap-[4px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[13px] font-medium text-white">
            View cart
            <ChevronRight className="h-[14px] w-[14px]" aria-hidden />
          </span>
        </a>
      ) : null}
    </div>
  );
}

const textareaClass =
  "block w-full rounded-[8px] border border-gray-300 bg-gray-50 px-[12px] py-[10px] text-[14px] font-normal text-gray-900 placeholder:text-gray-400 focus:border-[#1A56DB] focus:bg-white focus:outline-none";



"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Camera,
  CheckCircle2,
  Loader2,
  Minus,
  Package,
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
import { Avatar, Badge, Button, Input, Spinner } from "@/components/ui";
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
import { AdminError } from "@/lib/api/admin";
import { catalogApi } from "@/lib/api/catalog";
import type {
  AdminCreatePosOrderInput,
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

interface PosCartLine {
  lineKey: string;
  productId: string;
  variantId?: string;
  options?: Record<string, string>;
  qty: number;
  unitPrice: number;
  title: string;
  image?: string;
  sku?: string;
}

function makeLineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

/* -- Money helpers -- */

function formatMoney(amount: number): string {
  return `Tk ${amount.toLocaleString("en-IN")}`;
}

function estimateShipping(district: string): number {
  if (!district) return 0;
  return ["dhaka"].includes(district.trim().toLowerCase()) ? 60 : 130;
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
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-sm border border-neutral-200 bg-paper px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or SKU — or scan a barcode…"
            className="h-9 border-0 px-0 focus-visible:ring-0"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="text-neutral-500 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            title="Scan barcode with camera"
            aria-label="Open camera scanner"
            onClick={() => setCameraOpen(true)}
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span title="USB scanner active" className="flex shrink-0 items-center">
            <ScanLine className="h-3.5 w-3.5 text-neutral-300" aria-hidden />
          </span>
        </div>

        <BarcodeScanner
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={(code) => { setSearch(code); setCameraOpen(false); }}
          prompt="Point camera at product barcode to search"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[
            { value: "active", label: "Active only" },
            { value: "all", label: "All products" },
          ]}
          className="w-36"
        />
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as AdminProductSort)}
          options={SORT_OPTIONS}
          className="w-44"
        />
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
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
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
            "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
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

function ProductCard({ product, onSelect }: ProductCardProps) {
  const oos = product.stock <= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={oos && false}
      className={cn(
        "group flex flex-col gap-1.5 rounded-sm border border-neutral-200 bg-paper p-2 text-left",
        "transition-colors duration-hover ease-out hover:border-ink hover:shadow-sm",
        !product.isActive && "opacity-70",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-neutral-100">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            <Package className="h-6 w-6" aria-hidden />
          </div>
        )}
        {oos ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-[10px] font-medium text-white">
            Out of stock
          </span>
        ) : null}
        {!product.isActive ? (
          <span className="absolute right-1 top-1 rounded-sm bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
            Hidden
          </span>
        ) : null}
      </div>
      <div className="text-xs font-medium text-ink line-clamp-2">{product.title}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink tabular-nums">{formatMoney(product.price)}</span>
        <span className="text-neutral-500">{product.stock} in stock</span>
      </div>
    </button>
  );
}

/* -- Product configurator -- */

interface ProductConfiguratorProps {
  summary: AdminProductSummary;
  onClose: () => void;
  onConfirm: (line: PosCartLine) => void;
}

function ProductConfigurator({ summary, onClose, onConfirm }: ProductConfiguratorProps) {
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
  const [qty, setQty] = React.useState(1);

  React.useEffect(() => {
    if (firstInStock?.options) setSelection({ ...firstInStock.options });
  }, [firstInStock]);

  const matchedVariant = React.useMemo(() => {
    if (!detail?.variants?.length) return null;
    return (
      detail.variants.find((v) => {
        const opts = v.options ?? {};
        return axes.every((k) => opts[k] === selection[k]);
      }) ?? null
    );
  }, [detail, axes, selection]);

  const unitPrice = matchedVariant?.price ?? detail?.price ?? summary.price;
  const stock = matchedVariant?.stock ?? detail?.stock ?? summary.stock;
  const trackStock = detail?.trackStock ?? true;
  const overStock = trackStock && qty > stock;

  const handleAdd = () => {
    if (!detail) return;
    if (axes.length > 0 && !matchedVariant) return;
    onConfirm({
      lineKey: makeLineKey(detail._id, matchedVariant?._id),
      productId: detail._id,
      variantId: matchedVariant?._id,
      options:
        matchedVariant?.options && Object.keys(matchedVariant.options).length > 0
          ? matchedVariant.options
          : undefined,
      qty,
      unitPrice,
      title: detail.title,
      image: detail.images?.[0]?.url ?? summary.image,
      sku: matchedVariant?.sku,
    });
  };

  return (
    <div className="rounded-sm border border-ink bg-neutral-50 p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-paper">
            {summary.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.image} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{summary.title}</span>
            <span className="text-xs text-neutral-600 tabular-nums">
              {formatMoney(unitPrice)}
              {trackStock ? ` · ${stock} available` : ""}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close picker"
          onClick={onClose}
          className="rounded-sm p-1 text-neutral-500 hover:bg-neutral-200 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-ink">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {error}
        </div>
      ) : detail ? (
        <div className="flex flex-col gap-3">
          {axes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {axes.map((axis) => {
                const values = Array.from(
                  new Set(
                    (detail.variants ?? [])
                      .map((v) => v.options?.[axis])
                      .filter((x): x is string => typeof x === "string"),
                  ),
                );
                return (
                  <label key={axis} className="flex flex-col gap-1.5 text-xs text-neutral-600">
                    {axis}
                    <Select
                      value={selection[axis] ?? ""}
                      onChange={(e) =>
                        setSelection((prev) => ({ ...prev, [axis]: e.target.value }))
                      }
                      options={values.map((v) => ({ value: v, label: v }))}
                    />
                  </label>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrement quantity"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Input
                type="number"
                min={1}
                max={99}
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                }
                className="w-14 text-center"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                aria-label="Increment quantity"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={
                (axes.length > 0 && !matchedVariant) ||
                overStock ||
                (trackStock && stock <= 0)
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="ml-1.5">Add to order</span>
            </Button>
          </div>

          {overStock ? (
            <p className="text-xs text-ink">Only {stock} in stock for this variant.</p>
          ) : null}
          {axes.length > 0 && !matchedVariant ? (
            <p className="text-xs text-ink">That option combination isn&apos;t available.</p>
          ) : null}
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
}

function CartPanel({ lines, onIncrement, onDecrement, onRemove }: CartPanelProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 p-8 text-center">
        <ShoppingCart className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-400">No items yet — search and add products on the left.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {lines.map((line) => (
        <li key={line.lineKey} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          {/* Thumbnail */}
          <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50">
            {line.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={line.image} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-5 w-5 text-neutral-300" aria-hidden />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
              {line.title}
            </span>
            {line.options && Object.keys(line.options).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {Object.entries(line.options).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-0.5 rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10.5px] text-neutral-500"
                  >
                    {k}:<strong className="ml-0.5 text-ink">{v}</strong>
                  </span>
                ))}
              </div>
            ) : null}
            {line.sku ? (
              <span className="font-mono text-[10px] text-neutral-400">SKU: {line.sku}</span>
            ) : null}
            <div className="mt-0.5 text-xs tabular-nums text-neutral-500">
              {formatMoney(line.unitPrice)}
              <span className="mx-1 text-neutral-300">&times;</span>
              <span className="font-semibold text-ink">{line.qty}</span>
              <span className="mx-1 text-neutral-300">=</span>
              <span className="font-bold text-ink">{formatMoney(line.qty * line.unitPrice)}</span>
            </div>
          </div>

          {/* Stepper + Remove */}
          <div className="flex shrink-0 flex-col items-end justify-between gap-2">
            <div className="flex items-center overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => onDecrement(line.lineKey)}
                className="flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-50"
              >
                <Minus className="h-2.5 w-2.5" aria-hidden />
              </button>
              <span className="min-w-[1.75rem] select-none text-center text-xs font-bold tabular-nums text-ink">
                {line.qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => onIncrement(line.lineKey)}
                className="flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-50"
              >
                <Plus className="h-2.5 w-2.5" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              aria-label="Remove item"
              onClick={() => onRemove(line.lineKey)}
              className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Remove
            </button>
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
    <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <UserIcon className="h-3.5 w-3.5" aria-hidden /> Customer
        </h2>
        <div className="inline-flex items-center rounded-sm border border-neutral-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("walkin")}
            className={cn(
              "rounded-sm px-2.5 py-1",
              mode === "walkin"
                ? "bg-ink text-white"
                : "text-neutral-600 hover:text-ink",
            )}
          >
            <UserPlus className="inline h-3 w-3" aria-hidden /> Walk-in
          </button>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={cn(
              "rounded-sm px-2.5 py-1",
              mode === "existing"
                ? "bg-ink text-white"
                : "text-neutral-600 hover:text-ink",
            )}
          >
            <UserIcon className="inline h-3 w-3" aria-hidden /> Existing
          </button>
        </div>
      </header>

      {mode === "walkin" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Name *
            <Input
              value={walkin.name}
              onChange={(e) => setWalkin((s) => ({ ...s, name: e.target.value }))}
              placeholder="Customer name"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Phone *
            <Input
              value={walkin.phone}
              onChange={(e) => setWalkin((s) => ({ ...s, phone: e.target.value }))}
              placeholder="01XXXXXXXXX"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500 sm:col-span-2">
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-sm border border-neutral-300 px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone…"
              className="h-9 border-0 px-0 focus-visible:ring-0"
            />
          </div>
          {selectedUser ? (
            <div className="flex items-start gap-3 rounded-sm border border-neutral-200 bg-neutral-50 p-3">
              <Avatar src={selectedUser.avatar} alt={selectedUser.name} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-ink">{selectedUser.name}</span>
                <span className="truncate text-xs text-neutral-600">
                  {selectedUser.email}
                  {selectedUser.phone ? ` · ${selectedUser.phone}` : ""}
                </span>
              </div>
              <button
                type="button"
                aria-label="Clear selection"
                onClick={() => setExistingUserId(null)}
                className="text-neutral-500 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : usersLoading && debouncedSearch.length >= 2 ? (
            <div className="flex h-10 items-center justify-center">
              <Spinner />
            </div>
          ) : users.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded-sm border border-neutral-200">
              {users.map((u) => (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setExistingUserId(u._id);
                      setSearch("");
                    }}
                    className="flex w-full items-start gap-3 border-b border-neutral-100 p-3 text-left last:border-b-0 hover:bg-neutral-50"
                  >
                    <Avatar src={u.avatar} alt={u.name} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-ink">{u.name}</span>
                      <span className="truncate text-xs text-neutral-500">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedSearch.length >= 2 ? (
            <p className="text-xs text-neutral-500">
              No users match &ldquo;{debouncedSearch}&rdquo;.
            </p>
          ) : (
            <p className="text-xs text-neutral-500">
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

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="text-base font-semibold text-ink">Shipping address</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500 sm:col-span-2">
          Full name *
          <Input value={address.fullName} onChange={upd("fullName")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          Phone *
          <Input value={address.phone} onChange={upd("phone")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          Alt phone
          <Input value={address.altPhone ?? ""} onChange={upd("altPhone")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500 sm:col-span-2">
          Address line 1 *
          <Input value={address.line1} onChange={upd("line1")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500 sm:col-span-2">
          Address line 2
          <Input value={address.line2 ?? ""} onChange={upd("line2")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          City *
          <Input value={address.city} onChange={upd("city")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          District *
          <Input value={address.district} onChange={upd("district")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          Division
          <Input value={address.division ?? ""} onChange={upd("division")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
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
  city: "",
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
  const [customerNote, setCustomerNote] = React.useState("");
  const [internalNotes, setInternalNotes] = React.useState("");

  const createOrder = useCreatePosOrder();

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

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const shippingPreview = estimateShipping(address.district);
  const totalPreview = subtotal + shippingPreview;

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
    if (!address.city.trim()) return "Shipping: city required";
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
    }));

    const body: AdminCreatePosOrderInput = {
      shippingAddress: address,
      items,
      paymentMethod,
      paymentStatus: markPaid ? "paid" : "pending",
      transactionId: transactionId.trim() || undefined,
      couponCode: couponCode.trim().toUpperCase() || undefined,
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
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">POS — New Order</h1>
          <p className="text-sm text-neutral-500">
            In-person or phone sale. Stock is decremented atomically and the order lands confirmed.
          </p>
        </div>
        <Badge variant="muted">
          <Receipt className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
          Admin-only
        </Badge>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_400px]">
        {/* LEFT: product catalog */}
        <div className="rounded-sm border border-neutral-200 bg-paper p-3">
          <ProductPicker onAdd={onAdd} />
        </div>

        {/* RIGHT: order builder */}
        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <header className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden /> Items
              </h2>
              <span className="text-xs text-neutral-500">
                {lines.length} line{lines.length === 1 ? "" : "s"}
              </span>
            </header>
            <CartPanel
              lines={lines}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
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

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Banknote className="h-3.5 w-3.5" aria-hidden /> Payment
            </h2>
            <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
              Method
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                options={PAYMENT_OPTIONS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-ink focus-visible:ring-1 focus-visible:ring-ink"
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
              />
              Mark as paid now
            </label>
            {markPaid ? (
              <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
                Transaction ID (optional)
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="bKash trx / receipt #"
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
              Coupon code (optional)
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="SUMMER10"
              />
            </label>
          </section>

          <section className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Notes</h2>
            <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
              Customer-facing note
              <textarea
                className={textareaClass}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={2}
                placeholder="Visible on the invoice"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
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

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Total preview</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-neutral-600">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-600">Shipping (est.)</dt>
                <dd className="tabular-nums">{formatMoney(shippingPreview)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {formatMoney(totalPreview)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-neutral-500">
              Server re-computes shipping and applies the coupon — final total may differ slightly.
            </p>
            <Button
              size="md"
              onClick={onSubmit}
              disabled={Boolean(validationError) || createOrder.isPending}
              className="w-full"
              title={validationError ?? undefined}
            >
              {createOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              )}
              <span className="ml-1.5">Place order &amp; print invoice</span>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

const textareaClass =
  "block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1";



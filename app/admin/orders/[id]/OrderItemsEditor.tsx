"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AdminInlineSkeleton } from "@/components/admin/Skeleton";
import { Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/uiStore";
import { usePublicCustomizations } from "@/hooks/useCustomizations";
import {
  CustomizationFields,
  customizationAddOns,
  customizationOptions,
  draftFromOptions,
  isCustomizationKey,
  useCustomizationAssignment,
  type CustomizationDraft,
} from "@/components/admin/CustomizationEditor";
import {
  useAddAdminOrderItem,
  useAdminProducts,
  useRemoveAdminOrderItem,
  useUpdateAdminOrderItem,
  useUpdateOrderShipping,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { catalogApi } from "@/lib/api/catalog";
import type {
  AdminAddOrderItemInput,
  AdminOrderDetail,
  AdminProductSort,
  AdminProductSummary,
} from "@/types/admin";
import type { OrderItem, OrderStatus } from "@/types/commerce";
import type { ProductDetail } from "@/types/catalog";

/* ───────────────────── Helpers ───────────────────── */

/**
 * Statuses where the backend refuses item mutations (see
 * `addOrderItem` / `updateOrderItem` / `removeOrderItem` in
 * admin-order.controller.ts). We mirror them here so the UI doesn't
 * dangle non-functional controls when the order has reached a frozen
 * state.
 */
const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "delivered",
  "cancelled",
  "returned",
]);

function isEditableStatus(status: OrderStatus): boolean {
  return !TERMINAL_STATUSES.has(status);
}

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

/* ───────────────────── Sort options ───────────────────── */

const SORT_OPTIONS: Array<{ value: AdminProductSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-desc", label: "Price: high → low" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "stock-desc", label: "Stock: high → low" },
  { value: "stock-asc", label: "Stock: low → high" },
];

/* ───────────────────── Item row (editable) ───────────────────── */

interface ItemRowEditableProps {
  orderId: string;
  item: OrderItem;
  currency: string;
  /** Disable mutation buttons when the order status doesn't allow edits. */
  readOnly: boolean;
}

/**
 * Inline personalisation editor for an existing line - lets support staff
 * add, change, or remove Name / Number / Patches / Print on orders that
 * came in over social media or at the counter. The server preserves the
 * variant axes and re-prices the line.
 */
function LineCustomizationEditor({
  orderId,
  item,
  currency,
  onClose,
}: {
  orderId: string;
  item: OrderItem;
  currency: string;
  onClose: () => void;
}) {
  const toast = useUIStore((s) => s.toast);
  const updateItem = useUpdateAdminOrderItem(orderId);
  const { data: customizationConfig } = usePublicCustomizations();

  const [detail, setDetail] = React.useState<ProductDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    catalogApi
      .getProduct(item.slug)
      .then((p) => {
        if (!cancelled) setDetail(p);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.slug]);

  const { assignment, patchChoices, allowName, allowNumber } =
    useCustomizationAssignment(customizationConfig, detail);
  const [draft, setDraft] = React.useState<CustomizationDraft>(() =>
    draftFromOptions(item.options),
  );

  const hasExistingCustomization = Object.keys(item.options ?? {}).some(isCustomizationKey);

  const save = async (options: Record<string, string>) => {
    try {
      await updateItem.mutateAsync({ itemId: item._id, body: { options } });
      toast({
        title: Object.keys(options).length > 0 ? "Customization updated" : "Customization removed",
        tone: "success",
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof AdminError ? err.message : "Couldn't update customization";
      toast({ title: message, tone: "error" });
    }
  };

  return (
    <div className="mt-1 rounded-[8px] border border-gray-200 bg-gray-50 p-[12px]">
      {loading ? (
        <AdminInlineSkeleton rows={2} />
      ) : error ? (
        <p className="text-[13px] font-medium text-red-600">{error}</p>
      ) : !assignment ? (
        <p className="text-[13px] text-gray-500">
          No customization is configured for this product.
        </p>
      ) : (
        <>
          <CustomizationFields
            draft={draft}
            onChange={setDraft}
            config={customizationConfig}
            allowName={allowName}
            allowNumber={allowNumber}
            patchChoices={patchChoices}
            currency={currency}
          />
          <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
            <button
              type="button"
              onClick={() =>
                void save(customizationOptions(draft, allowName, allowNumber, patchChoices))
              }
              disabled={updateItem.isPending}
              className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[13px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateItem.isPending ? (
                <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
              ) : (
                <Check className="h-[14px] w-[14px]" aria-hidden />
              )}
              Save customization
            </button>
            {hasExistingCustomization ? (
              <button
                type="button"
                onClick={() => void save({})}
                disabled={updateItem.isPending}
                className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-red-300 bg-white px-[12px] text-[13px] font-medium text-red-600 transition duration-75 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-[14px] w-[14px]" aria-hidden />
                Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[36px] items-center rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ItemRowEditable({ orderId, item, currency, readOnly }: ItemRowEditableProps) {
  const toast = useUIStore((s) => s.toast);
  const updateItem = useUpdateAdminOrderItem(orderId);
  const removeItem = useRemoveAdminOrderItem(orderId);
  const [customOpen, setCustomOpen] = React.useState(false);

  // Local qty so the cashier can stage a multi-step change (type "5", commit
  // on blur) without the +/- buttons feeling laggy. We sync from props
  // whenever the order refetch lands so the row never drifts from server
  // truth.
  const [localQty, setLocalQty] = React.useState(item.qty);
  React.useEffect(() => setLocalQty(item.qty), [item.qty]);

  const busy = updateItem.isPending || removeItem.isPending;
  const optionEntries = item.options ? Object.entries(item.options) : [];

  const commit = async (next: number) => {
    const safe = Math.max(1, Math.min(99, Math.floor(next)));
    if (safe === item.qty) {
      setLocalQty(item.qty);
      return;
    }
    try {
      await updateItem.mutateAsync({ itemId: item._id, body: { qty: safe } });
      toast({ title: "Quantity updated", tone: "success" });
    } catch (err) {
      const message =
        err instanceof AdminError ? err.message : "Couldn't update quantity";
      toast({ title: message, tone: "error" });
      // Revert the optimistic local state - the user can try again.
      setLocalQty(item.qty);
    }
  };

  const onRemove = async () => {
    if (!window.confirm(`Remove "${item.title}" from this order?`)) return;
    try {
      await removeItem.mutateAsync(item._id);
      toast({ title: "Line removed", tone: "success" });
    } catch (err) {
      const message =
        err instanceof AdminError ? err.message : "Couldn't remove line";
      toast({ title: message, tone: "error" });
    }
  };

  return (
    <li className="border-b border-neutral-100 px-1.5 py-1 last:border-b-0">
      <div className="flex items-start gap-1">
      <div className="h-5 w-5 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex flex-1 min-w-0 flex-col">
        <Link
          href={`/product/${item.slug}`}
          className="text-sm text-ink underline-offset-2 hover:underline truncate"
          target="_blank"
          rel="noreferrer"
        >
          {item.title}
        </Link>
        <div className="text-xs text-neutral-500">
          {item.sku ? `SKU ${item.sku}` : null}
          {item.sku && optionEntries.length > 0 ? " · " : null}
          {optionEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}
        </div>
        <div className="text-xs text-neutral-600 tabular-nums">
          {formatMoney(item.price, currency)} each
        </div>
      </div>

      {!readOnly ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => commit(localQty - 1)}
              disabled={busy || localQty <= 1}
              className="rounded-sm border border-neutral-300 p-0.5 text-neutral-700 hover:border-ink hover:text-ink disabled:opacity-50"
            >
              <Minus className="h-2 w-2" aria-hidden />
            </button>
            <Input
              type="number"
              min={1}
              max={99}
              value={localQty}
              onChange={(e) =>
                setLocalQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
              }
              onBlur={() => commit(localQty)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit(localQty);
                }
              }}
              disabled={busy}
              className="w-12 text-center"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => commit(localQty + 1)}
              disabled={busy || localQty >= 99}
              className="rounded-sm border border-neutral-300 p-0.5 text-neutral-700 hover:border-ink hover:text-ink disabled:opacity-50"
            >
              <Plus className="h-2 w-2" aria-hidden />
            </button>
          </div>
          <div className="text-sm font-medium text-ink tabular-nums">
            {formatMoney(item.lineTotal, currency)}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCustomOpen((o) => !o)}
              disabled={busy}
              className="text-[11px] text-neutral-500 hover:text-[#1A56DB] disabled:opacity-50"
              title="Add or edit personalisation on this line"
            >
              <Pencil className="inline h-2 w-2" aria-hidden /> Customize
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-[11px] text-neutral-500 hover:text-red-600 disabled:opacity-50"
            >
              {removeItem.isPending ? (
                <Loader2 className="inline h-2 w-2 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="inline h-2 w-2" aria-hidden />
              )}{" "}
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 text-right text-xs">
          <div className="text-neutral-600">
            {item.qty} × {formatMoney(item.price, currency)}
          </div>
          <div className="text-sm font-medium text-ink tabular-nums">
            {formatMoney(item.lineTotal, currency)}
          </div>
        </div>
      )}
      </div>

      {/* Expandable personalisation editor */}
      {customOpen && !readOnly ? (
        <LineCustomizationEditor
          orderId={orderId}
          item={item}
          currency={currency}
          onClose={() => setCustomOpen(false)}
        />
      ) : null}
    </li>
  );
}

/* ───────────────────── Inline product picker ─────────────────────
 *
 * Mirror of the picker baked into /admin/pos - we deliberately don't
 * share the implementation yet because the order editor flows the
 * confirmation through `useAddAdminOrderItem` (a real network mutation)
 * while the POS queues lines into local state. The duplication keeps
 * each callsite free of branching that would muddy the contract.
 */

interface PickerProps {
  orderId: string;
  onClose: () => void;
  onAdded: () => void;
}

function AddItemPicker({ orderId, onClose, onAdded }: PickerProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sort, setSort] = React.useState<AdminProductSort>("newest");
  const [status, setStatus] = React.useState<"active" | "all">("active");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  React.useEffect(() => setPage(1), [debouncedSearch, sort, status]);

  const params = React.useMemo(
    () => ({
      q: debouncedSearch || undefined,
      sort,
      status,
      limit: 8,
      page,
    }),
    [debouncedSearch, sort, status, page],
  );

  const { data, isLoading, isFetching } = useAdminProducts(params);
  const products = data?.data?.products ?? [];
  const meta = data?.meta;

  const [selected, setSelected] = React.useState<AdminProductSummary | null>(null);

  return (
    <div className="rounded-md border border-neutral-300 bg-neutral-50 p-1.5">
      <header className="mb-1 flex items-center justify-between gap-1">
        <h3 className="flex items-center gap-0.5 text-sm font-semibold text-ink">
          <Plus className="h-2 w-2" aria-hidden /> Add an item
        </h3>
        <button
          type="button"
          aria-label="Close picker"
          onClick={onClose}
          className="rounded-sm p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-ink"
        >
          <X className="h-2 w-2" aria-hidden />
        </button>
      </header>

      <div className="mb-1 flex flex-wrap items-center gap-1">
        <div className="flex flex-1 items-center gap-0.5 rounded-sm border border-neutral-300 bg-paper px-1">
          <Search className="h-2 w-2 text-neutral-500" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by title or SKU…"
            className="h-5 border-0 px-0 focus-visible:ring-0"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="text-neutral-500 hover:text-ink"
            >
              <X className="h-2 w-2" aria-hidden />
            </button>
          ) : null}
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[
            { value: "active", label: "Active only" },
            { value: "all", label: "All products" },
          ]}
          className="w-32"
        />
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as AdminProductSort)}
          options={SORT_OPTIONS}
          className="w-40"
        />
      </div>

      {selected ? (
        <ItemConfigurator
          orderId={orderId}
          summary={selected}
          onCancel={() => setSelected(null)}
          onAdded={() => {
            setSelected(null);
            onAdded();
          }}
        />
      ) : null}

      {isLoading ? (
        <AdminInlineSkeleton rows={3} withThumb />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-0.5 rounded-md border border-dashed border-neutral-300 bg-paper p-1.5 text-center text-xs text-neutral-600">
          <Package className="h-3 w-3 text-neutral-400" aria-hidden />
          {debouncedSearch
            ? `No products match "${debouncedSearch}"`
            : "No products to show"}
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-1 md:grid-cols-3 lg:grid-cols-4",
            isFetching && "opacity-70",
          )}
        >
          {products.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => setSelected(p)}
              className={cn(
                "group flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-paper p-1 text-left",
                "transition-colors duration-hover ease-out hover:border-ink hover:shadow-sm",
                !p.isActive && "opacity-70",
              )}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-neutral-100">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-neutral-300">
                    <Package className="h-4 w-4" aria-hidden />
                  </div>
                )}
                {p.stock <= 0 ? (
                  <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-0.5 text-center text-[10px] font-medium text-paper">
                    Out of stock
                  </span>
                ) : null}
                {!p.isActive ? (
                  <span className="absolute right-0.5 top-0.5 rounded-sm bg-neutral-200 px-1 text-[10px] font-medium text-neutral-700">
                    Hidden
                  </span>
                ) : null}
              </div>
              <div className="text-xs font-medium text-ink line-clamp-2">
                {p.title}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink tabular-nums">
                  {formatMoney(p.price, p.currency)}
                </span>
                <span className="text-neutral-500">{p.stock} in stock</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {meta && meta.totalPages && meta.totalPages > 1 ? (
        <footer className="mt-1 flex items-center justify-between border-t border-neutral-200 pt-1 text-xs text-neutral-600">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} products
          </span>
          <div className="flex items-center gap-0.5">
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
    </div>
  );
}

/* ───────────────────── Configurator ─────────────────────
 *
 * Pulls the full ProductDetail (variant array + axes) and lets the
 * cashier choose the right combo + qty. On confirm we call the
 * `addOrderItem` endpoint which performs the same atomic stock pull
 * as checkout and either lands the line or returns 409.
 */

interface ConfiguratorProps {
  orderId: string;
  summary: AdminProductSummary;
  onCancel: () => void;
  onAdded: () => void;
}

function ItemConfigurator({ orderId, summary, onCancel, onAdded }: ConfiguratorProps) {
  const toast = useUIStore((s) => s.toast);
  const addItem = useAddAdminOrderItem(orderId);

  const [detail, setDetail] = React.useState<ProductDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    catalogApi
      .getProduct(summary.slug)
      .then((p) => {
        if (cancelled) return;
        setDetail(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  /* Customization - same assignment matching + option encoding as the POS
   * configurator and the storefront PDP. The server re-prices add-ons. */
  const { data: customizationConfig } = usePublicCustomizations();
  const { assignment, patchChoices, allowName, allowNumber } =
    useCustomizationAssignment(customizationConfig, detail);
  const [custom, setCustom] = React.useState<CustomizationDraft>(() => draftFromOptions(undefined));
  React.useEffect(() => {
    setCustom(draftFromOptions(undefined));
  }, [detail?._id]);
  const addOnTotal = customizationAddOns(
    custom,
    customizationConfig,
    allowName,
    allowNumber,
    patchChoices,
  ).reduce((s, a) => s + a.amount, 0);

  const unitPrice = (matchedVariant?.price ?? detail?.price ?? summary.price) + addOnTotal;
  const stock = matchedVariant?.stock ?? detail?.stock ?? summary.stock;
  const trackStock = detail?.trackStock ?? true;
  const overStock = trackStock && qty > stock;

  const onConfirm = async () => {
    if (!detail) return;
    if (axes.length > 0 && !matchedVariant) return;
    const options: Record<string, string> = {
      ...(matchedVariant?.options ?? {}),
      ...customizationOptions(custom, allowName, allowNumber, patchChoices),
    };
    const body: AdminAddOrderItemInput = {
      productId: detail._id,
      variantId: matchedVariant?._id,
      qty,
      options: Object.keys(options).length > 0 ? options : undefined,
    };
    try {
      await addItem.mutateAsync(body);
      toast({ title: `Added ${detail.title}`, tone: "success" });
      onAdded();
    } catch (err) {
      const message =
        err instanceof AdminError ? err.message : "Couldn't add the line";
      toast({ title: message, tone: "error" });
    }
  };

  return (
    <div className="mb-1 rounded-md border border-ink bg-paper p-1.5">
      <header className="mb-1 flex items-start justify-between gap-1">
        <div className="flex flex-1 items-start gap-1 min-w-0">
          <div className="h-5 w-5 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-paper">
            {summary.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={summary.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-1 flex-col min-w-0">
            <span className="text-sm font-semibold text-ink truncate">
              {summary.title}
            </span>
            <span className="text-xs text-neutral-600 tabular-nums">
              {formatMoney(unitPrice, summary.currency)}
              {trackStock ? ` · ${stock} available` : ""}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cancel"
          onClick={onCancel}
          className="rounded-sm p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
        >
          <X className="h-2 w-2" aria-hidden />
        </button>
      </header>

      {loading ? (
        <AdminInlineSkeleton rows={2} />
      ) : error ? (
        <div className="flex items-center gap-0.5 text-xs text-ink">
          <AlertTriangle className="h-2 w-2" aria-hidden /> {error}
        </div>
      ) : detail ? (
        <div className="flex flex-col gap-1">
          {axes.length > 0 ? (
            <div className="grid grid-cols-2 gap-1">
              {axes.map((axis) => {
                const values = Array.from(
                  new Set(
                    (detail.variants ?? [])
                      .map((v) => v.options?.[axis])
                      .filter((x): x is string => typeof x === "string"),
                  ),
                );
                return (
                  <label key={axis} className="flex flex-col gap-0.5 text-xs text-neutral-600">
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

          {/* Customization - only for products with a matching assignment */}
          {assignment && (allowName || allowNumber || patchChoices.length > 0) ? (
            <div className="border-t border-gray-200 pt-[12px]">
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
              {addOnTotal > 0 ? (
                <p className="mt-[8px] text-[13px] font-semibold text-gray-900">
                  Unit price with add-ons: {formatMoney(unitPrice, detail?.currency ?? "BDT")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-0.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrement quantity"
              >
                <Minus className="h-2 w-2" aria-hidden />
              </Button>
              <Input
                type="number"
                min={1}
                max={99}
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                }
                className="w-12 text-center"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                aria-label="Increment quantity"
              >
                <Plus className="h-2 w-2" aria-hidden />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={
                addItem.isPending ||
                (axes.length > 0 && !matchedVariant) ||
                overStock ||
                (trackStock && stock <= 0)
              }
            >
              {addItem.isPending ? (
                <Loader2 className="h-2 w-2 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-2 w-2" aria-hidden />
              )}
              <span className="ml-0.5">Add to order</span>
            </Button>
          </div>

          {overStock ? (
            <p className="text-xs text-ink">
              Only {stock} in stock for this variant.
            </p>
          ) : null}
          {axes.length > 0 && !matchedVariant ? (
            <p className="text-xs text-ink">
              That option combination isn&apos;t available.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────── Totals block ───────────────────── */

function TotalsBlock({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const updateShipping = useUpdateOrderShipping(order._id);
  const editable = isEditableStatus(order.status);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const saveShipping = async () => {
    const value = Math.max(0, Number(draft) || 0);
    try {
      await updateShipping.mutateAsync(value);
      toast({ title: "Delivery charge updated", tone: "success" });
      setEditing(false);
    } catch (err) {
      const message =
        err instanceof AdminError ? err.message : "Couldn't update the delivery charge";
      toast({ title: message, tone: "error" });
    }
  };

  const row = (label: string, amount: number, accent = false) => (
    <div className="flex items-center justify-between text-xs">
      <span className={accent ? "text-ink font-semibold" : "text-neutral-600"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          accent ? "text-base font-semibold text-ink" : "text-ink",
        )}
      >
        {formatMoney(amount, order.currency)}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-0.5 border-t border-neutral-200 px-1.5 py-1">
      {row("Subtotal", order.subtotal)}
      {order.discount > 0 ? row("Discount", -order.discount) : null}

      {/* Delivery charge - manually editable while the order is still live
          (0 = free delivery / pickup). Server recomputes the total. */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-600">Delivery</span>
        {editing ? (
          <span className="flex items-center gap-[6px]">
            <input
              inputMode="numeric"
              aria-label="Delivery charge"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void saveShipping(); }
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-[28px] w-[80px] rounded-[6px] border border-gray-300 bg-gray-50 px-[8px] text-right text-[13px] tabular-nums text-gray-900 focus:border-[#1A56DB] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void saveShipping()}
              disabled={updateShipping.isPending}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] bg-[#1A56DB] text-white transition duration-75 hover:bg-[#1E429F] disabled:opacity-50"
              aria-label="Save delivery charge"
            >
              {updateShipping.isPending ? (
                <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
              ) : (
                <Check className="h-[14px] w-[14px]" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Cancel"
            >
              <X className="h-[14px] w-[14px]" aria-hidden />
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-[6px]">
            <span className="tabular-nums text-ink">
              {formatMoney(order.shippingCost, order.currency)}
            </span>
            {editable ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(String(order.shippingCost ?? 0));
                  setEditing(true);
                }}
                title="Edit delivery charge"
                aria-label="Edit delivery charge"
                className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-[#1A56DB]"
              >
                <Pencil className="h-[12px] w-[12px]" aria-hidden />
              </button>
            ) : null}
          </span>
        )}
      </div>

      {order.tax > 0 ? row("Tax", order.tax) : null}
      {row("Total", order.total, true)}
    </div>
  );
}

/* ───────────────────── Items card ───────────────────── */

export interface OrderItemsEditorProps {
  order: AdminOrderDetail;
}

export function OrderItemsEditor({ order }: OrderItemsEditorProps) {
  const editable = isEditableStatus(order.status);
  const [picking, setPicking] = React.useState(false);

  return (
    <section className="rounded-md border border-neutral-200 bg-paper">
      <header className="flex items-center justify-between border-b border-neutral-200 px-1.5 py-1">
        <h2 className="flex items-center gap-0.5 text-base font-semibold text-ink">
          <Package className="h-2 w-2" aria-hidden /> Items
        </h2>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <span>
            {order.items.length} line{order.items.length === 1 ? "" : "s"}
          </span>
          {editable && !picking ? (
            <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
              <Plus className="h-2 w-2" aria-hidden />
              <span className="ml-0.5">Add item</span>
            </Button>
          ) : null}
        </div>
      </header>

      {editable && picking ? (
        <div className="border-b border-neutral-200 px-1.5 py-1">
          <AddItemPicker
            orderId={order._id}
            onClose={() => setPicking(false)}
            onAdded={() => setPicking(false)}
          />
        </div>
      ) : null}

      <ul>
        {order.items.map((it) => (
          <ItemRowEditable
            key={it._id}
            orderId={order._id}
            item={it}
            currency={order.currency}
            readOnly={!editable}
          />
        ))}
        {order.items.length === 0 ? (
          <li className="flex items-center justify-center px-1.5 py-3 text-xs text-neutral-500">
            No items on this order yet.
          </li>
        ) : null}
      </ul>

      <TotalsBlock order={order} />

      {!editable ? (
        <p className="border-t border-neutral-100 px-1.5 py-1 text-[11px] text-neutral-500">
          Items are locked because this order is{" "}
          <span className="font-medium text-ink">{order.status}</span>.
        </p>
      ) : null}
    </section>
  );
}

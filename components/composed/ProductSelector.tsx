"use client";

/**
 * ProductSelector
 * ─────────────────────────────────────────────────────────────────────────
 * A modal-backed multi-select for admin product ids. Wired primarily into
 * the offer form (`/admin/offers/[id]`) where the moderator builds the
 * allow-list a discount applies to, but written generically so the coupon
 * form and any future "pick a basket of products" surface can share it.
 *
 * Design intent:
 *  • The component is *uncontrolled with respect to the picker UI*. The
 *    caller passes `value` (an array of product ids) and `onChange`; the
 *    chips render outside the modal so the user can see the current
 *    selection at a glance. Inside the modal we operate on a local draft
 *    set so the user can cancel without committing changes.
 *  • Filters mirror the admin products list (q, category, brand, status,
 *    sort) and round-trip via `useQuery` keyed on the filter set, so
 *    paging back and forth doesn't refetch unnecessarily.
 *  • Cross-page "Select all matching" calls the backend's `idsOnly=1`
 *    short-circuit, which returns just the matching ids without pagination
 *    (capped at 10k). We never try to walk pages client-side - the request
 *    would balloon over a large catalog.
 *  • A name cache (Map<id, summary>) bridges the gap between "ids the user
 *    selected" and "labels we can render on the chips". It's seeded from
 *    the `seed` prop (so an offer's already-populated products show with
 *    titles on initial mount) and grows as the moderator browses the
 *    modal. Ids without a cached summary still show, just with a generic
 *    "Product …xxxx" fallback - fine, because the offer detail repopulates
 *    after save.
 */

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  CheckSquare,
  ListChecks,
  Loader2,
  Package,
  Pencil,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { Modal } from "@/components/complex/Modal";
import { Pagination } from "./Pagination";
import { Select, type SelectOption } from "./Select";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";
import { adminApi } from "@/lib/api/admin";
import { catalogApi } from "@/lib/api/catalog";
import type {
  AdminListProductsParams,
  AdminProductSort,
  AdminProductStatus,
  AdminProductSummary,
} from "@/types/admin";

/* ───────────────────── Types ───────────────────── */

/**
 * Slim shape needed to render a chip. The offer detail endpoint
 * populates products as `OfferProductRef[]` which is a superset of this,
 * so callers can `seed={offer.products}` directly.
 */
export interface ProductChipSeed {
  _id: string;
  title: string;
  slug?: string;
  price?: number;
  image?: string;
}

export interface ProductSelectorProps {
  /** Currently selected product ids. */
  value: string[];
  /** Called when the user confirms a selection change in the modal. */
  onChange: (ids: string[]) => void;
  /**
   * Optional pre-known product summaries. Used to label chips on first
   * render before the user opens the modal. Anything found in here goes
   * straight into the name cache.
   */
  seed?: ReadonlyArray<ProductChipSeed>;
  /** Visual error state - applies a red border to the trigger row. */
  invalid?: boolean;
  /** Hint shown when nothing is selected. */
  emptyHint?: string;
  /** Optional label above the chips row. */
  label?: string;
  /** Disables the trigger button. */
  disabled?: boolean;
  /** Hard cap on selections. Defaults to no cap. */
  max?: number;
}

interface NameCacheEntry {
  title: string;
  slug?: string;
  price?: number;
  image?: string;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All products" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive" },
  { value: "out-of-stock", label: "Out of stock" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-desc", label: "Price · high to low" },
  { value: "price-asc", label: "Price · low to high" },
  { value: "stock-desc", label: "Stock · high to low" },
  { value: "stock-asc", label: "Stock · low to high" },
];

/* ───────────────────── Trigger / chips ───────────────────── */

export function ProductSelector({
  value,
  onChange,
  seed,
  invalid,
  emptyHint = "No products picked yet. Open the picker to add some.",
  label,
  disabled,
  max,
}: ProductSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // The name cache lives at the outer component so it survives modal
  // open/close cycles. It's keyed by id, populated from `seed` on first
  // render and topped up whenever the modal renders a search result.
  const [nameCache, setNameCache] = React.useState<Map<string, NameCacheEntry>>(() => {
    const m = new Map<string, NameCacheEntry>();
    if (seed) {
      for (const s of seed) {
        m.set(s._id, {
          title: s.title,
          slug: s.slug,
          price: s.price,
          image: s.image,
        });
      }
    }
    return m;
  });

  // Re-seed when `seed` changes (e.g. the offer detail finishes loading
  // after the initial form mount). We don't clobber entries that have
  // already been added from the modal - those came from fresher data.
  React.useEffect(() => {
    if (!seed?.length) return;
    setNameCache((prev) => {
      const next = new Map(prev);
      for (const s of seed) {
        if (!next.has(s._id)) {
          next.set(s._id, {
            title: s.title,
            slug: s.slug,
            price: s.price,
            image: s.image,
          });
        }
      }
      return next;
    });
  }, [seed]);

  const learn = React.useCallback((rows: AdminProductSummary[]) => {
    if (!rows.length) return;
    setNameCache((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        next.set(row._id, {
          title: row.title,
          slug: row.slug,
          price: row.price,
          image: row.image,
        });
      }
      return next;
    });
  }, []);

  const handleRemove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Stable ordering for chips: seed order first, then anything added in
  // the modal (which we just preserve in `value`'s natural order).
  const ordered = value;

  return (
    <div className="flex flex-col gap-0.5">
      {label ? (
        <span className="text-xs font-medium text-neutral-700">{label}</span>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-1 rounded-sm border bg-paper p-1",
          invalid ? "border-ink" : "border-neutral-300",
        )}
      >
        <div className="flex flex-wrap items-center gap-0.5">
          {ordered.length === 0 ? (
            <p className="px-0.5 py-0.5 text-xs text-neutral-500">{emptyHint}</p>
          ) : (
            ordered.map((id) => (
              <ProductChip
                key={id}
                id={id}
                entry={nameCache.get(id)}
                onRemove={() => handleRemove(id)}
                disabled={disabled}
              />
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-neutral-200 pt-1">
          <div className="text-[11px] text-neutral-600">
            <span className="tabular-nums font-medium text-ink">{value.length}</span>
            {value.length === 1 ? " product picked" : " products picked"}
            {typeof max === "number" ? (
              <span className="text-neutral-400"> · max {max}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5">
            {value.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={disabled}
                aria-label="Clear all selected products"
              >
                <Trash2 className="h-2 w-2" aria-hidden />
                <span className="ml-0.5">Clear</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={disabled}
            >
              <Pencil className="h-2 w-2" aria-hidden />
              <span className="ml-0.5">
                {value.length > 0 ? "Edit selection" : "Pick products"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <ProductSelectorModal
        open={open}
        onClose={() => setOpen(false)}
        initialSelected={value}
        onConfirm={(ids) => {
          onChange(ids);
          setOpen(false);
        }}
        onLearn={learn}
        max={max}
      />
    </div>
  );
}

/* ───────────────────── Chip ───────────────────── */

interface ProductChipProps {
  id: string;
  entry: NameCacheEntry | undefined;
  onRemove: () => void;
  disabled?: boolean;
}

function ProductChip({ id, entry, onRemove, disabled }: ProductChipProps) {
  const label = entry?.title ?? `Product …${id.slice(-6)}`;
  return (
    <span
      className="inline-flex max-w-full items-center gap-0.5 rounded-sm border border-neutral-200 bg-neutral-50 px-1 py-0.5 text-xs text-ink"
      title={entry?.title ? `${entry.title} (${id})` : id}
    >
      <Package className="h-2 w-2 shrink-0 text-neutral-500" aria-hidden />
      <span className="truncate max-w-[180px]">{label}</span>
      {!disabled ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${entry?.title ?? id}`}
          className="-m-0.5 rounded-sm p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-ink"
        >
          <X className="h-2 w-2" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

/* ───────────────────── Modal ───────────────────── */

interface ProductSelectorModalProps {
  open: boolean;
  onClose: () => void;
  initialSelected: string[];
  onConfirm: (ids: string[]) => void;
  onLearn: (rows: AdminProductSummary[]) => void;
  max?: number;
}

function ProductSelectorModal({
  open,
  onClose,
  initialSelected,
  onConfirm,
  onLearn,
  max,
}: ProductSelectorModalProps) {
  // Draft selection: a Set we mutate while the modal is open. We rebuild
  // it every time the modal opens so cancel-after-changes really does
  // throw the changes away.
  const [draft, setDraft] = React.useState<Set<string>>(() => new Set(initialSelected));
  React.useEffect(() => {
    if (open) setDraft(new Set(initialSelected));
    // Reset filters on open too so the user starts from a clean slate
    // and isn't confused by stale state from a previous picker session.
    if (open) {
      setQDraft("");
      setCategory("");
      setBrand("");
      setStatus("all");
      setSort("newest");
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Filters ── */
  const [qDraft, setQDraft] = React.useState("");
  const q = useDebounce(qDraft.trim(), 250);
  const [category, setCategory] = React.useState<string>("");
  const [brand, setBrand] = React.useState<string>("");
  const [status, setStatus] = React.useState<AdminProductStatus>("all");
  const [sort, setSort] = React.useState<AdminProductSort>("newest");
  const [page, setPage] = React.useState(1);
  const limit = 24;

  // Reset to page 1 when any filter changes - otherwise the user lands on
  // an empty page 5 after narrowing the result set.
  React.useEffect(() => {
    setPage(1);
  }, [q, category, brand, status, sort]);

  const listParams = React.useMemo<AdminListProductsParams>(
    () => ({
      q: q || undefined,
      category: category || undefined,
      brand: brand || undefined,
      status,
      sort,
      page,
      limit,
    }),
    [q, category, brand, status, sort, page],
  );

  /* ── Data ── */
  const productsQuery = useQuery({
    queryKey: ["admin", "product-selector", listParams],
    queryFn: () => adminApi.listProducts(listParams),
    placeholderData: keepPreviousData,
    enabled: open,
    staleTime: 30_000,
  });

  // Categories + brands for the filter dropdowns. We only fetch when the
  // modal is open - the lists rarely change so they're held in cache
  // across opens.
  const categoriesQuery = useQuery({
    queryKey: ["admin", "product-selector", "categories"],
    queryFn: () => catalogApi.listCategories({ shape: "flat", isActive: true }),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const brandsQuery = useQuery({
    queryKey: ["admin", "product-selector", "brands"],
    queryFn: () => catalogApi.listBrands({ isActive: true, limit: 200 }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // Feed the outer name cache as new rows stream in.
  const rows = productsQuery.data?.data.products ?? [];
  React.useEffect(() => {
    if (rows.length) onLearn(rows);
    // We deliberately don't depend on `onLearn` (the parent recreates it
    // each render but it's stable behaviour-wise via useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const total = productsQuery.data?.meta?.total ?? 0;
  const totalPages = productsQuery.data?.meta?.totalPages ?? 1;

  // Dropdown options derived from the catalog queries. Hoisted so the
  // hook order stays stable regardless of which branch the JSX renders.
  const categoryOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All categories" },
      ...(categoriesQuery.data ?? []).map((c) => ({
        value: c._id,
        label: c.name,
      })),
    ],
    [categoriesQuery.data],
  );

  const brandOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All brands" },
      ...(brandsQuery.data?.data ?? []).map((b) => ({
        value: b._id,
        label: b.name,
      })),
    ],
    [brandsQuery.data],
  );

  /* ── Selection helpers ── */
  const toggleOne = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (typeof max === "number" && next.size >= max) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => draft.has(r._id));

  const someOnPageSelected =
    rows.some((r) => draft.has(r._id)) && !allOnPageSelected;

  const togglePage = () => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const r of rows) next.delete(r._id);
      } else {
        for (const r of rows) {
          if (typeof max === "number" && next.size >= max) break;
          next.add(r._id);
        }
      }
      return next;
    });
  };

  const [selectAllPending, setSelectAllPending] = React.useState(false);
  const selectAllMatching = async () => {
    setSelectAllPending(true);
    try {
      // `idsOnly` short-circuits the projection on the backend and skips
      // pagination, returning every id matching the current filter set
      // (capped at 10k). Strict union with the existing draft so the
      // user's prior selections survive a "select all" on a different
      // filter slice.
      const { ids } = await adminApi.listProductIds({
        q: q || undefined,
        category: category || undefined,
        brand: brand || undefined,
        status,
      });
      setDraft((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (typeof max === "number" && next.size >= max) break;
          next.add(id);
        }
        return next;
      });
    } finally {
      setSelectAllPending(false);
    }
  };

  const clearAllInDraft = () => setDraft(new Set());

  /* ── Render ── */
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Pick products"
      description="Use the filters to narrow the catalog, then check the products this surface should target. Selections persist as you change filters."
      className="md:max-w-4xl"
    >
      <div className="flex flex-col gap-1">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-neutral-600">Search</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Title or slug"
                className="pl-3"
              />
            </div>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-neutral-600">Category</span>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={categoriesQuery.isLoading}
              options={categoryOptions}
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-neutral-600">Brand</span>
            <Select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              disabled={brandsQuery.isLoading}
              options={brandOptions}
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-neutral-600">Status</span>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as AdminProductStatus)}
              options={STATUS_OPTIONS}
            />
          </label>
        </div>

        {/* Bulk + sort row */}
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-sm border border-neutral-200 bg-neutral-50 px-1 py-1 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={togglePage}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-0.5 rounded-sm border border-neutral-300 bg-paper px-1 py-0.5 text-xs text-ink hover:border-ink disabled:opacity-50"
              aria-pressed={allOnPageSelected}
            >
              {allOnPageSelected ? (
                <CheckSquare className="h-2 w-2" aria-hidden />
              ) : someOnPageSelected ? (
                <ListChecks className="h-2 w-2" aria-hidden />
              ) : (
                <Square className="h-2 w-2" aria-hidden />
              )}
              <span>
                {allOnPageSelected
                  ? "Unselect page"
                  : someOnPageSelected
                    ? "Select rest of page"
                    : "Select page"}
              </span>
            </button>
            <button
              type="button"
              onClick={selectAllMatching}
              disabled={selectAllPending || total === 0}
              className="inline-flex items-center gap-0.5 rounded-sm border border-neutral-300 bg-paper px-1 py-0.5 text-xs text-ink hover:border-ink disabled:opacity-50"
            >
              {selectAllPending ? (
                <Loader2 className="h-2 w-2 animate-spin" aria-hidden />
              ) : (
                <ListChecks className="h-2 w-2" aria-hidden />
              )}
              <span>Select all matching ({total.toLocaleString()})</span>
            </button>
            <button
              type="button"
              onClick={clearAllInDraft}
              disabled={draft.size === 0}
              className="inline-flex items-center gap-0.5 rounded-sm border border-neutral-300 bg-paper px-1 py-0.5 text-xs text-ink hover:border-ink disabled:opacity-50"
            >
              <Trash2 className="h-2 w-2" aria-hidden />
              <span>Clear selection</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Badge>
              {draft.size} selected
              {typeof max === "number" ? ` / ${max} max` : ""}
            </Badge>
            <label className="flex items-center gap-0.5">
              <span className="text-[11px] text-neutral-600">Sort</span>
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as AdminProductSort)}
                options={SORT_OPTIONS}
                className="text-xs"
              />
            </label>
          </div>
        </div>

        {/* Grid */}
        <div className="min-h-[260px]">
          {productsQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : productsQuery.isError ? (
            <p className="rounded-sm border border-neutral-200 p-2 text-center text-sm text-neutral-600">
              Couldn't load products. Try again in a moment.
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-sm border border-dashed border-neutral-300 p-2 text-center text-sm text-neutral-500">
              No products match the current filter set. Loosen a filter to see more.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => {
                const checked = draft.has(row._id);
                const atCap =
                  !checked && typeof max === "number" && draft.size >= max;
                return (
                  <li key={row._id}>
                    <ProductCardRow
                      row={row}
                      checked={checked}
                      disabled={atCap}
                      onToggle={() => toggleOne(row._id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pager */}
        {totalPages > 1 ? (
          <div className="flex justify-end">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between gap-1 border-t border-neutral-200 pt-1">
          <p className="text-[11px] text-neutral-500">
            Changes apply only after you click <em>Apply selection</em>.
          </p>
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onConfirm(Array.from(draft))}
            >
              <CheckSquare className="h-2 w-2" aria-hidden />
              <span className="ml-0.5">
                Apply selection ({draft.size})
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────── Product row card ───────────────────── */

interface ProductCardRowProps {
  row: AdminProductSummary;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

function ProductCardRow({ row, checked, disabled, onToggle }: ProductCardRowProps) {
  const price = formatPrice(row.price, row.currency);
  const compareAt = row.compareAtPrice
    ? formatPrice(row.compareAtPrice, row.currency)
    : null;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-start gap-1 rounded-sm border bg-paper p-1 text-left transition-colors duration-hover",
        checked
          ? "border-ink bg-neutral-50"
          : "border-neutral-200 hover:border-ink",
        disabled && !checked ? "opacity-50" : "",
      )}
    >
      <span className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border border-neutral-300 bg-paper">
        {checked ? (
          <CheckSquare className="h-2 w-2 text-ink" aria-hidden />
        ) : null}
      </span>
      {row.image ? (
        // Cloudinary-served URLs are pre-sized; this <img> stays raw so
        // the picker doesn't need Next/Image config for arbitrary hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.image}
          alt=""
          className="h-7 w-7 shrink-0 rounded-sm border border-neutral-200 object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-400">
          <Package className="h-3 w-3" aria-hidden />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{row.title}</span>
        <span className="flex flex-wrap items-baseline gap-1 text-xs">
          <span className="tabular-nums font-medium text-ink">{price}</span>
          {compareAt ? (
            <span className="tabular-nums text-neutral-400 line-through">{compareAt}</span>
          ) : null}
          {!row.isActive ? (
            <Badge variant="outline">Inactive</Badge>
          ) : row.stock === 0 ? (
            <Badge variant="muted">Out</Badge>
          ) : null}
        </span>
        <span className="truncate text-[11px] text-neutral-500">
          {row.category?.name ?? "-"}
          {row.brand?.name ? ` · ${row.brand.name}` : ""}
        </span>
      </span>
    </button>
  );
}

/* ───────────────────── Utilities ───────────────────── */

function formatPrice(value: number, currency: string): string {
  // Avoid locale-specific NumberFormat churn - the admin surface stays
  // BDT-leaning; a thousands-separated integer with a code prefix is
  // enough context for the picker. Decimal precision is preserved as-is.
  const formatted = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toFixed(2);
  return `${currency || "BDT"} ${formatted}`;
}


"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Eye,
  EyeOff,
  Loader2,
  Package,
  Plus,
  Ruler,
  Search,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import {
  ExportCsvButton,
  Pagination,
  Select,
  SizeChartEditor,
  draftToSizeChartInput,
  type SizeChartDraft,
} from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminProducts,
  useBulkApplySizeChart,
  useDeleteAdminProduct,
  useUpdateAdminProduct,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminListProductsParams,
  AdminProductSort,
  AdminProductStatus,
  AdminProductSummary,
} from "@/types/admin";

const STATUS_FILTERS: { value: AdminProductStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Hidden" },
  { value: "out-of-stock", label: "Out of stock" },
];

const SORT_OPTIONS: { value: AdminProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-desc", label: "Price: high → low" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "stock-asc", label: "Stock: low → high" },
  { value: "stock-desc", label: "Stock: high → low" },
];

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

/* "" Product row "" */

interface ProductRowProps {
  product: AdminProductSummary;
  selected: boolean;
  onToggleSelect: () => void;
}

function ProductRow({ product, selected, onToggleSelect }: ProductRowProps) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateAdminProduct(product._id);
  const remove = useDeleteAdminProduct();
  const busy =
    update.isPending || (remove.isPending && remove.variables === product._id);

  const onToggleActive = async () => {
    try {
      await update.mutateAsync({ isActive: !product.isActive });
      toast({
        title: product.isActive ? "Product hidden" : "Product activated",
        tone: "success",
      });
    } catch (err) {
      toast({
        title:
          err instanceof AdminError
            ? err.message
            : "Couldn't update product",
        tone: "error",
      });
    }
  };

  const onToggleFeatured = async () => {
    try {
      await update.mutateAsync({ isFeatured: !product.isFeatured });
      toast({
        title: product.isFeatured ? "Removed from featured" : "Featured",
        tone: "success",
      });
    } catch (err) {
      toast({
        title:
          err instanceof AdminError
            ? err.message
            : "Couldn't update product",
        tone: "error",
      });
    }
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        `Delete "${product.title}"? This cannot be undone — orders that reference it will keep their snapshot copy.`,
      )
    )
      return;
    try {
      await remove.mutateAsync(product._id);
      toast({ title: "Product deleted", tone: "success" });
    } catch (err) {
      toast({
        title:
          err instanceof AdminError ? err.message : "Couldn't delete",
        tone: "error",
      });
    }
  };

  return (
    <tr
      className={cn(
        "transition-colors hover:bg-neutral-50",
        selected && "bg-accent/10",
      )}
    >
      {/* Checkbox */}
      <td className="w-8 px-2 py-2.5 align-middle">
        <button
          type="button"
          onClick={onToggleSelect}
          className="flex items-center text-neutral-400 hover:text-ink"
          aria-label={selected ? "Deselect product" : "Select product"}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-ink" aria-hidden />
          ) : (
            <Square className="h-4 w-4" aria-hidden />
          )}
        </button>
      </td>

      {/* Product — name, meta, status badges all in one cell */}
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/products/${product.slug}`}
              className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
            >
              {product.title}
            </Link>
            <p className="truncate text-xs text-neutral-400">
              {[product.category?.name, product.brand?.name, product.seller?.name].filter(Boolean).join(" · ") || "-"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  "rounded-sm px-1.5 py-px text-[10px] font-semibold",
                  product.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-neutral-100 text-neutral-500",
                )}
              >
                {product.isActive ? "Active" : "Hidden"}
              </span>
              {product.isFeatured ? (
                <span className="inline-flex items-center gap-0.5 rounded-sm bg-accent/25 px-1.5 py-px text-[10px] font-semibold text-ink">
                  <Star className="h-2.5 w-2.5" aria-hidden /> Featured
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </td>

      {/* Price + Stock */}
      <td className="px-3 py-2.5 align-middle tabular-nums">
        <p className="text-sm font-medium text-ink">
          {formatMoney(product.price, product.currency)}
        </p>
        {product.compareAtPrice && product.compareAtPrice > product.price ? (
          <p className="text-xs text-neutral-400 line-through">
            {formatMoney(product.compareAtPrice, product.currency)}
          </p>
        ) : null}
        <p className={cn(
          "text-xs",
          product.stock === 0
            ? "font-semibold text-red-500"
            : product.stock <= 5
              ? "font-semibold text-amber-600"
              : "text-neutral-500",
        )}>
          {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
        </p>
      </td>

      {/* Actions — icon buttons only */}
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleActive}
            disabled={busy}
            title={product.isActive ? "Hide product" : "Activate product"}
            aria-label={product.isActive ? "Hide" : "Activate"}
          >
            {update.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : product.isActive ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleFeatured}
            disabled={busy}
            title={product.isFeatured ? "Remove from featured" : "Mark as featured"}
            aria-label={product.isFeatured ? "Unfeature" : "Feature"}
          >
            <Star
              className={cn("h-3.5 w-3.5", product.isFeatured && "fill-current")}
              aria-hidden
            />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={busy}
            title="Delete product"
            aria-label="Delete"
          >
            {remove.isPending && remove.variables === product._id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
          <Link
            href={`/admin/products/${product.slug}`}
            title="Edit product"
            aria-label="Edit product"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </td>
    </tr>
  );
}

/* "" Bulk size chart panel "" */

interface SizeChartBulkPanelProps {
  selectedCount: number;
  open: boolean;
  onClose: () => void;
  onApply: (sizeChart: ReturnType<typeof draftToSizeChartInput> | null) => void;
  applying: boolean;
}

function SizeChartBulkPanel({
  selectedCount,
  open,
  onClose,
  onApply,
  applying,
}: SizeChartBulkPanelProps) {
  const [draft, setDraft] = React.useState<SizeChartDraft | null>(null);

  React.useEffect(() => {
    if (open) setDraft(null);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[560px] max-w-[95vw] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div>
            <p className="text-base font-semibold text-ink">
              Bulk apply size chart
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {selectedCount} product{selectedCount !== 1 ? "s" : ""} selected
              — this overwrites any existing chart on each product.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 text-neutral-400 hover:text-ink"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <SizeChartEditor value={draft} onChange={setDraft} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-6 py-4">
          <button
            type="button"
            onClick={() => onApply(null)}
            disabled={applying}
            className="text-sm text-neutral-500 underline-offset-2 hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Remove chart from selection
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const sc = draft ? draftToSizeChartInput(draft) : undefined;
                onApply(sc ?? null);
              }}
              disabled={applying || !draft}
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Ruler className="h-4 w-4" aria-hidden />
              )}
              <span className="ml-1.5">
                Apply to {selectedCount} product{selectedCount !== 1 ? "s" : ""}
              </span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* "" Main component "" */

export function ProductsAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useUIStore((s) => s.toast);

  const status = (search.get("status") ?? "all") as AdminProductStatus;
  const sort = (search.get("sort") ?? "newest") as AdminProductSort;
  const qFromUrl = search.get("q") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  /* Selection state */
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkPanelOpen, setBulkPanelOpen] = React.useState(false);
  const bulkMutation = useBulkApplySizeChart();

  const updateUrl = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({ q: qDraft.trim() || undefined });
  };

  const params: AdminListProductsParams = React.useMemo(
    () => ({
      status: status !== "all" ? status : undefined,
      sort,
      q: qFromUrl || undefined,
      page,
      limit: 20,
    }),
    [status, sort, qFromUrl, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminProducts(params);
  const products = data?.data.products ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive =
    status !== "all" || Boolean(qFromUrl) || sort !== "newest";

  /* Clear selection when page/filters change */
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [status, sort, qFromUrl, page]);

  const allOnPageSelected =
    products.length > 0 && products.every((p) => selectedIds.has(p._id));
  const someOnPageSelected =
    products.some((p) => selectedIds.has(p._id)) && !allOnPageSelected;

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of products) next.delete(p._id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of products) next.add(p._id);
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkApply = async (
    sizeChart: ReturnType<typeof draftToSizeChartInput> | null,
  ) => {
    const ids = [...selectedIds];
    try {
      const result = await bulkMutation.mutateAsync({
        ids,
        sizeChart: sizeChart ?? null,
      });
      toast({
        title: sizeChart
          ? `Size chart applied to ${result.updated} product${result.updated !== 1 ? "s" : ""}`
          : `Size chart removed from ${result.updated} product${result.updated !== 1 ? "s" : ""}`,
        tone: "success",
      });
      setBulkPanelOpen(false);
      clearSelection();
    } catch (err) {
      toast({
        title:
          err instanceof AdminError
            ? err.message
            : "Bulk operation failed",
        tone: "error",
      });
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Products</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Toggle visibility, feature standouts, or remove items from the
              catalog.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {meta ? (
              <span className="text-sm text-neutral-400">
                {meta.total.toLocaleString("en-US")} total
              </span>
            ) : null}
            <ExportCsvButton
              path="/admin/products/export.csv"
              params={{
                status: status !== "all" ? status : undefined,
                sort,
                q: qFromUrl || undefined,
              }}
              disabled={!meta || meta.total === 0}
            />
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" aria-hidden /> New product
            </Link>
          </div>
        </header>

        {/* Status tabs */}
        <nav aria-label="Product status filter" className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() =>
                  updateUrl({
                    status: f.value === "all" ? undefined : f.value,
                  })
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-ink",
                )}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </nav>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
          <form onSubmit={onSubmitSearch} className="flex min-w-[180px] flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
              <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Title or slug" className="pl-8" />
            </div>
            <button type="submit" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Find</button>
          </form>
          <div className="h-5 w-px bg-neutral-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-400">Sort</span>
            <Select value={sort} onChange={(e) => updateUrl({ sort: e.target.value })} options={SORT_OPTIONS} />
          </div>
          {filtersActive ? (
            <>
              <div className="h-5 w-px bg-neutral-200" />
              <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink">
                <X className="h-3 w-3" aria-hidden /> Clear
              </button>
            </>
          ) : null}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
            <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-500">
              {error instanceof AdminError
                ? error.message
                : "Couldn't load products."}
            </p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
            <Package className="h-8 w-8 text-neutral-200" aria-hidden />
            <div>
              <p className="font-medium text-neutral-600">
                {filtersActive
                  ? "No products match these filters."
                  : "No products yet."}
              </p>
              {!filtersActive && (
                <p className="mt-0.5 text-sm text-neutral-400">
                  Add your first product to start selling.
                </p>
              )}
            </div>
            {!filtersActive && (
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4" aria-hidden /> Add first product
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="w-8 px-2 py-2.5 align-middle">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="flex items-center text-neutral-400 hover:text-ink"
                      aria-label={allOnPageSelected ? "Deselect all on page" : "Select all on page"}
                    >
                      {allOnPageSelected ? (
                        <CheckSquare className="h-4 w-4 text-ink" aria-hidden />
                      ) : someOnPageSelected ? (
                        <CheckSquare className="h-4 w-4 text-neutral-300" aria-hidden />
                      ) : (
                        <Square className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Product
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Price / Stock
                  </th>
                  <th className="px-3 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((p) => (
                  <ProductRow
                    key={p._id}
                    product={p}
                    selected={selectedIds.has(p._id)}
                    onToggleSelect={() => toggleOne(p._id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => updateUrl({ page: String(p) })}
            className="mt-2"
          />
        ) : null}
      </div>

      {/* Bulk action bar — floats at bottom when items are selected */}
      {selectedCount > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-5 py-3 shadow-xl">
            <span className="text-sm font-medium text-ink tabular-nums">
              {selectedCount} product{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <div className="h-4 w-px bg-neutral-200" aria-hidden />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkPanelOpen(true)}
            >
              <Ruler className="h-4 w-4" aria-hidden />
              <span className="ml-1.5">Apply size chart</span>
            </Button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-sm p-1.5 text-neutral-400 hover:text-ink"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {/* Bulk size chart panel */}
      <SizeChartBulkPanel
        selectedCount={selectedCount}
        open={bulkPanelOpen}
        onClose={() => setBulkPanelOpen(false)}
        onApply={handleBulkApply}
        applying={bulkMutation.isPending}
      />
    </>
  );
}


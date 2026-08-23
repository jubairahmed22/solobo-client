"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  Ruler,
  Search,
  ShoppingCart,
  Square,
  Star,
  Trash2,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminListSkeleton, AdminInlineSkeleton } from "@/components/admin/Skeleton";
import { FloatingMenu } from "@/components/admin/FloatingMenu";
import {
  ExportCsvButton,
  Pagination,
  Select,
  SizeChartEditor,
  VariantsEditor,
  draftToSizeChartInput,
  draftsToVariantInputs,
  extractOptionDefs,
  variantToDraft,
  type OptionDef,
  type SelectOption,
  type SizeChartDraft,
  type VariantDraft,
} from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminInventoryStats,
  useAdminProduct,
  useAdminProducts,
  useBulkApplySizeChart,
  useDeleteAdminProduct,
  useUpdateAdminProduct,
} from "@/hooks/useAdmin";
import { useBrands, useCategories } from "@/hooks/useCatalog";
import { flattenCategoryTree } from "@/lib/utils/category";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminListProductsParams,
  AdminProductDetail,
  AdminProductPatch,
  AdminProductSort,
  AdminProductStatus,
  AdminProductSummary,
  AdminProductVariantInput,
  AdminProductVariantSummary,
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

/* "" Inventory KPI strip ""
 * Every number here is a real backend aggregate (GET /admin/products/
 * inventory-stats) - this store has no purchase-order/stock-intake
 * tracking, so there's no "units purchased" metric; "Units Sold" sums qty
 * across recognised orders (delivered ∪ returned) instead. No badge shows
 * a fabricated percentage - deltas are the real recent-period counts the
 * dashboard's own KPI tiles already use (e.g. "+N this month"), and cards
 * with no honest baseline (Current Stock, Inventory Value - this store
 * keeps no stock-history snapshots) simply don't get one. */

function InventoryKpiCard({
  label,
  value,
  badge,
  hint,
  Icon,
}: {
  label: string;
  value: string;
  badge?: string;
  hint: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-[8px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-[14px] font-medium text-gray-500">{label}</span>
        <Icon className="h-[18px] w-[18px] shrink-0 text-[#1A56DB]" aria-hidden />
      </div>
      <div className="flex flex-wrap items-baseline gap-[8px]">
        <span className="text-[24px] font-bold leading-none tabular-nums text-gray-900">
          {value}
        </span>
        {badge ? (
          <span className="rounded-[4px] bg-green-50 px-[6px] py-[2px] text-[12px] font-medium text-green-700">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="text-[12px] text-gray-400">{hint}</span>
    </div>
  );
}

function InventoryStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[104px] animate-pulse rounded-[8px] border border-gray-200 bg-gray-50"
        />
      ))}
    </div>
  );
}

function InventoryStatsSection() {
  const { data, isLoading } = useAdminInventoryStats();

  if (isLoading || !data) return <InventoryStatsSkeleton />;

  const missingCost = data.productsMissingCostPrice;
  const inventoryHint =
    missingCost > 0
      ? `Based on current cost price · ${missingCost} product${missingCost === 1 ? "" : "s"} missing cost, excluded`
      : "Based on current cost price";

  return (
    <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
      <InventoryKpiCard
        label="Total Products"
        value={data.totalProducts.toLocaleString("en-US")}
        badge={data.productsAddedRecent > 0 ? `+${data.productsAddedRecent}` : undefined}
        hint="Listed in your catalog"
        Icon={Package}
      />
      <InventoryKpiCard
        label="Units Sold"
        value={data.unitsSoldRecent.toLocaleString("en-US")}
        hint="Last 30 days · delivered or returned orders"
        Icon={ShoppingCart}
      />
      <InventoryKpiCard
        label="Current Stock"
        value={`${data.currentStock.toLocaleString("en-US")} pcs`}
        hint="Across all products and variants"
        Icon={Boxes}
      />
      <InventoryKpiCard
        label="Inventory Value"
        value={formatMoney(data.inventoryValue, data.currency)}
        hint={inventoryHint}
        Icon={Wallet}
      />
    </div>
  );
}

/* "" Size/variant stock breakdown "" */

function VariantStockTable({ variants }: { variants: AdminProductVariantSummary[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
          <th className="py-[6px] pr-[12px] font-medium">Variant</th>
          <th className="py-[6px] pr-[12px] font-medium">SKU</th>
          <th className="py-[6px] pr-[12px] text-right font-medium">Stock</th>
          <th className="py-[6px] pr-[12px] font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {variants.map((v) => (
          <tr key={v._id} className="border-t border-gray-100">
            <td className="py-[6px] pr-[12px] text-gray-900">{v.optionsLabel || "—"}</td>
            <td className="py-[6px] pr-[12px] font-mono text-[12px] text-gray-500">{v.sku || "—"}</td>
            <td
              className={cn(
                "py-[6px] pr-[12px] text-right font-medium tabular-nums",
                v.stock === 0 ? "text-red-600" : v.stock <= 5 ? "text-yellow-700" : "text-gray-900",
              )}
            >
              {v.stock}
            </td>
            <td className="py-[6px] pr-[12px]">
              {v.isActive ? (
                <span className="text-gray-500">Active</span>
              ) : (
                <span className="text-gray-400">Hidden</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* "" Product row "" */

interface ProductRowProps {
  product: AdminProductSummary;
  selected: boolean;
  onToggleSelect: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenInventory: (id: string) => void;
}

/** Shared row/card mutation logic - reused by the desktop table row and the
 *  mobile card so they stay in sync. */
function useProductActions(product: AdminProductSummary) {
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

  return { update, remove, busy, onToggleActive, onToggleFeatured, onDelete };
}

function ProductRow({
  product,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpand,
  onOpenInventory,
}: ProductRowProps) {
  const { update, remove, busy, onToggleActive, onToggleFeatured, onDelete } =
    useProductActions(product);
  const hasVariants = product.variants.length > 0;

  return (
    <>
    <tr
      className={cn(
        "bg-white transition duration-75 hover:bg-gray-50",
        selected && "bg-blue-50 hover:bg-blue-50",
      )}
    >
      {/* Checkbox */}
      <td className="w-8 px-[8px] py-[14px] align-top">
        <button
          type="button"
          onClick={onToggleSelect}
          className="flex items-center text-gray-400 transition duration-75 hover:text-gray-900"
          aria-label={selected ? "Deselect product" : "Select product"}
        >
          {selected ? (
            <CheckSquare className="h-[16px] w-[16px] text-[#1A56DB]" aria-hidden />
          ) : (
            <Square className="h-[16px] w-[16px]" aria-hidden />
          )}
        </button>
      </td>

      {/* Product — thumbnail + name only; category/SKU/status now have their own columns */}
      <td className="px-[16px] py-[14px] align-top">
        <div className="flex items-start gap-[12px]">
          <div className="h-[40px] w-[40px] shrink-0 overflow-hidden rounded-[8px] border border-gray-100 bg-gray-50">
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
          <div className="min-w-0 max-w-[240px]">
            <Link
              href={`/admin/products/${product.slug}`}
              className="block truncate text-[14px] font-semibold text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline"
            >
              {product.title}
            </Link>
            {product.brand?.name || product.seller?.name ? (
              <p className="truncate text-[12px] text-gray-500">
                {[product.brand?.name, product.seller?.name].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      </td>

      {/* SKU — the product's own code, distinct from each variant's SKU
          (already visible in the Variants expand row below). Truncated to
          one line (full value on hover) so a long SKU can't stretch the
          row taller than its neighbours. */}
      <td className="px-[16px] py-[14px] align-top">
        <span
          className="block max-w-[160px] truncate font-mono text-[12px] text-gray-600"
          title={product.sku || undefined}
        >
          {product.sku || "—"}
        </span>
      </td>

      {/* Category */}
      <td className="px-[16px] py-[14px] align-top">
        <span className="text-[13px] text-gray-700">{product.category?.name ?? "—"}</span>
      </td>

      {/* Price */}
      <td className="px-[16px] py-[14px] text-right align-top tabular-nums">
        <p className="text-[14px] font-semibold text-gray-900">
          {formatMoney(product.price, product.currency)}
        </p>
        {product.compareAtPrice && product.compareAtPrice > product.price ? (
          <p className="text-[12px] text-gray-400 line-through">
            {formatMoney(product.compareAtPrice, product.currency)}
          </p>
        ) : null}
      </td>

      {/* Purch. Qty — all-time units sold (recognised orders); see the
          header's tooltip for why "sold" stands in for "purchased" here. */}
      <td className="px-[16px] py-[14px] text-right align-top tabular-nums">
        <span className="text-[13px] text-gray-700">{product.unitsSold.toLocaleString("en-US")}</span>
      </td>

      {/* Curr. Qty — real current stock (sums variant stock for variant products). */}
      <td className="px-[16px] py-[14px] text-right align-top tabular-nums">
        <span
          className={cn(
            "text-[13px] font-medium",
            product.currentStock === 0
              ? "text-red-600"
              : product.currentStock <= 5
                ? "text-yellow-700"
                : "text-gray-900",
          )}
        >
          {product.currentStock.toLocaleString("en-US")}
        </span>
      </td>

      {/* Variants */}
      <td className="px-[16px] py-[14px] align-top">
        {hasVariants ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-[2px] text-[12px] font-medium text-[#1A56DB] hover:underline"
          >
            {expanded ? (
              <ChevronDown className="h-[12px] w-[12px]" aria-hidden />
            ) : (
              <ChevronRight className="h-[12px] w-[12px]" aria-hidden />
            )}
            {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
          </button>
        ) : (
          <span className="text-[12px] text-gray-400">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-[16px] py-[14px] align-top">
        <div className="flex flex-col items-start gap-[4px]">
          <span
            className={cn(
              "rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium",
              product.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800",
            )}
          >
            {product.isActive ? "Active" : "Hidden"}
          </span>
          {product.isFeatured ? (
            <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-yellow-100 px-[10px] py-[2px] text-[12px] font-medium text-yellow-800">
              <Star className="h-[12px] w-[12px]" aria-hidden /> Featured
            </span>
          ) : null}
        </div>
      </td>

      {/* Actions — single "..." trigger, see FloatingMenu's own docs */}
      <td className="px-[16px] py-[14px] align-top text-right">
        <div className="flex items-start justify-end">
          <FloatingMenu
            items={[
              {
                label: "Add Inventory",
                icon: PackagePlus,
                onClick: () => onOpenInventory(product._id),
              },
              {
                label: product.isActive ? "Hide product" : "Activate product",
                icon: product.isActive ? EyeOff : Eye,
                onClick: onToggleActive,
                disabled: busy,
                loading: update.isPending,
              },
              {
                label: product.isFeatured ? "Remove from featured" : "Mark as featured",
                icon: Star,
                onClick: onToggleFeatured,
                disabled: busy,
              },
              {
                label: "Edit product",
                icon: ArrowRight,
                href: `/admin/products/${product.slug}`,
              },
              {
                label: "Delete product",
                icon: Trash2,
                onClick: onDelete,
                disabled: busy,
                loading: remove.isPending && remove.variables === product._id,
                destructive: true,
              },
            ]}
          />
        </div>
      </td>
    </tr>
    {hasVariants && expanded ? (
      <tr className="bg-gray-50">
        <td />
        <td colSpan={9} className="px-[16px] py-[10px]">
          <VariantStockTable variants={product.variants} />
        </td>
      </tr>
    ) : null}
    </>
  );
}

/* "" Mobile product card - native-app list cell with the same actions "" */

function ProductCardMobile({
  product,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpand,
  onOpenInventory,
}: ProductRowProps) {
  const { update, remove, busy, onToggleActive, onToggleFeatured, onDelete } =
    useProductActions(product);

  return (
    <div className={cn("p-[16px]", selected && "bg-blue-50")}>
      <div className="flex gap-[12px]">
        {/* Select checkbox */}
        <button
          type="button"
          onClick={onToggleSelect}
          className="mt-[2px] shrink-0 text-gray-400 transition duration-75 hover:text-gray-900"
          aria-label={selected ? "Deselect product" : "Select product"}
        >
          {selected ? (
            <CheckSquare className="h-[20px] w-[20px] text-[#1A56DB]" aria-hidden />
          ) : (
            <Square className="h-[20px] w-[20px]" aria-hidden />
          )}
        </button>

        {/* Thumbnail */}
        <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[8px] border border-gray-100 bg-gray-50">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-[8px]">
            <Link
              href={`/admin/products/${product.slug}`}
              className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-900 hover:text-[#1A56DB]"
            >
              {product.title}
            </Link>
            <span className="shrink-0 text-[14px] font-bold tabular-nums text-gray-900">
              {formatMoney(product.price, product.currency)}
            </span>
          </div>
          <p className="mt-[2px] truncate text-[12px] text-gray-500">
            {[product.category?.name, product.brand?.name, product.seller?.name].filter(Boolean).join(" · ") || "-"}
          </p>
          <p className="mt-[1px] truncate font-mono text-[11px] text-gray-400">
            SKU: {product.sku || "—"}
          </p>
          <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
            <span
              className={cn(
                "rounded-[4px] px-[8px] py-[2px] text-[11px] font-medium",
                product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
              )}
            >
              {product.isActive ? "Active" : "Hidden"}
            </span>
            {product.isFeatured ? (
              <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-yellow-100 px-[8px] py-[2px] text-[11px] font-medium text-yellow-800">
                <Star className="h-[11px] w-[11px]" aria-hidden /> Featured
              </span>
            ) : null}
            <span
              className={cn(
                "text-[11px] font-medium",
                product.currentStock === 0
                  ? "text-red-600"
                  : product.currentStock <= 5
                    ? "text-yellow-700"
                    : "text-gray-500",
              )}
            >
              {product.currentStock === 0 ? "Out of stock" : `${product.currentStock} in stock`}
            </span>
            <span className="text-[11px] font-medium text-gray-500">
              {product.unitsSold.toLocaleString("en-US")} sold
            </span>
            {product.variants.length > 0 ? (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-[2px] text-[11px] font-medium text-[#1A56DB]"
              >
                {expanded ? (
                  <ChevronDown className="h-[11px] w-[11px]" aria-hidden />
                ) : (
                  <ChevronRight className="h-[11px] w-[11px]" aria-hidden />
                )}
                {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {expanded && product.variants.length > 0 ? (
        <div className="mt-[10px] overflow-x-auto rounded-[8px] border border-gray-100 bg-gray-50 px-[10px]">
          <VariantStockTable variants={product.variants} />
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-[12px] flex items-center gap-[4px] border-t border-gray-100 pt-[12px]">
        <button
          type="button"
          onClick={() => onOpenInventory(product._id)}
          title="Add Inventory"
          aria-label="Add Inventory"
          className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-600 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
        >
          <PackagePlus className="h-[16px] w-[16px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy}
          className="inline-flex h-[32px] items-center gap-[6px] rounded-[8px] px-[10px] text-[13px] font-medium text-gray-600 transition duration-75 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
        >
          {update.isPending ? (
            <Loader2 className="h-[16px] w-[16px] animate-spin" aria-hidden />
          ) : product.isActive ? (
            <EyeOff className="h-[16px] w-[16px]" aria-hidden />
          ) : (
            <Eye className="h-[16px] w-[16px]" aria-hidden />
          )}
          {product.isActive ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={busy}
          aria-label={product.isFeatured ? "Unfeature" : "Feature"}
          className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-600 transition duration-75 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
        >
          <Star className={cn("h-[16px] w-[16px]", product.isFeatured && "fill-current text-yellow-500")} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label="Delete"
          className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-400 transition duration-75 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
        >
          {remove.isPending && remove.variables === product._id ? (
            <Loader2 className="h-[16px] w-[16px] animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-[16px] w-[16px]" aria-hidden />
          )}
        </button>
        <Link
          href={`/admin/products/${product.slug}`}
          className="ml-auto inline-flex h-[32px] items-center gap-[4px] rounded-[8px] px-[12px] text-[13px] font-medium text-[#1A56DB] transition duration-75 hover:bg-gray-100"
        >
          Edit <ArrowRight className="h-[14px] w-[14px]" aria-hidden />
        </Link>
      </div>
    </div>
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

/* "" Add to inventory drawer ""
 * Quick-edit panel for a single product's Pricing / Inventory / Variants -
 * the same three cards the full edit page (/admin/products/[slug]) shows,
 * without leaving the list. Deliberately plain useState (not react-hook-
 * form/zod like the full form) since this is a fast top-up action, not the
 * full product editor - the PATCH endpoint still validates everything
 * server-side either way.
 */

function DrawerField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[6px] text-[13px] font-medium text-gray-900">
      {label}
      {children}
      {hint ? <span className="text-[12px] font-normal text-gray-500">{hint}</span> : null}
    </label>
  );
}

interface AddToInventoryFormProps {
  product: AdminProductDetail;
  onClose: () => void;
}

function AddToInventoryForm({ product, onClose }: AddToInventoryFormProps) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateAdminProduct(product._id);

  const [price, setPrice] = React.useState(String(product.price ?? 0));
  const [compareAtPrice, setCompareAtPrice] = React.useState(
    product.compareAtPrice !== undefined ? String(product.compareAtPrice) : "",
  );
  const [costPrice, setCostPrice] = React.useState(
    product.costPrice !== undefined ? String(product.costPrice) : "",
  );
  const [stock, setStock] = React.useState(String(product.stock ?? 0));
  const [trackStock, setTrackStock] = React.useState(product.trackStock ?? true);
  const [lowStockThreshold, setLowStockThreshold] = React.useState(
    String(
      (product as AdminProductDetail & { lowStockThreshold?: number }).lowStockThreshold ?? 5,
    ),
  );

  const [variantOptions, setVariantOptions] = React.useState<OptionDef[]>(() =>
    extractOptionDefs((product.variants ?? []).map(variantToDraft)),
  );
  const [variants, setVariants] = React.useState<VariantDraft[]>(() =>
    (product.variants ?? []).map(variantToDraft),
  );

  const variantsCount = variants.length;
  const variantsStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  const handleSave = async () => {
    const patch: AdminProductPatch = {
      price: Math.max(0, Number(price) || 0),
      compareAtPrice: compareAtPrice.trim() === "" ? undefined : Math.max(0, Number(compareAtPrice) || 0),
      costPrice: costPrice.trim() === "" ? undefined : Math.max(0, Number(costPrice) || 0),
      stock: Math.max(0, Math.floor(Number(stock) || 0)),
      trackStock,
      lowStockThreshold: Math.max(0, Math.floor(Number(lowStockThreshold) || 0)),
      variants: draftsToVariantInputs(variants) as AdminProductVariantInput[],
    };
    try {
      await update.mutateAsync(patch);
      toast({ title: "Inventory updated", tone: "success" });
      onClose();
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Couldn't update inventory",
        tone: "error",
      });
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-[20px]">
          {/* Pricing */}
          <section className="flex flex-col gap-[12px]">
            <h3 className="text-[14px] font-semibold text-gray-900">Pricing</h3>
            <DrawerField label={`Selling Price (${product.currency})`}>
              <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </DrawerField>
            <DrawerField
              label="Compare-at price (Was)"
              hint="Shown as strikethrough on the product card."
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
              />
            </DrawerField>
            <DrawerField
              label={`Purchase Cost (${product.currency})`}
              hint="What you paid for one unit - admin-only, drives margin reporting. Never shown to customers."
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </DrawerField>
          </section>

          {/* Inventory */}
          <section className="flex flex-col gap-[12px] border-t border-gray-200 pt-[16px]">
            <h3 className="text-[14px] font-semibold text-gray-900">Inventory</h3>
            <DrawerField label="Stock">
              <Input
                type="number"
                min={0}
                step={1}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                disabled={variantsCount > 0}
              />
            </DrawerField>
            {variantsCount > 0 ? (
              <p className="text-[12px] text-gray-500">
                Summed from {variantsCount} variant{variantsCount === 1 ? "" : "s"} —{" "}
                <span className="tabular-nums text-gray-900">{variantsStock}</span> total.
              </p>
            ) : null}
            <label className="flex items-center gap-[8px] text-[14px] font-medium text-gray-900">
              <input
                type="checkbox"
                className="h-[16px] w-[16px] rounded border-gray-300"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
              />
              Track stock
            </label>
            <DrawerField label="Low-stock alert" hint="Set 0 to disable.">
              <Input
                type="number"
                min={0}
                step={1}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </DrawerField>
          </section>

          {/* Variants */}
          <section className="flex flex-col gap-[12px] border-t border-gray-200 pt-[16px]">
            <h3 className="text-[14px] font-semibold text-gray-900">Variants</h3>
            <VariantsEditor
              options={variantOptions}
              onOptionsChange={setVariantOptions}
              variants={variants}
              onVariantsChange={setVariants}
              currency={product.currency}
              basePrice={Number(price) || undefined}
            />
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-[8px] border-t border-neutral-200 px-6 py-4">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <PackagePlus className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-1.5">Save</span>
        </Button>
      </div>
    </>
  );
}

function AddToInventoryDrawerContent({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const { data: product, isLoading, isError } = useAdminProduct(productId);

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">
            {product ? product.title : "Add Inventory"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Pricing, purchase cost, stock and variants.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-sm p-1.5 text-neutral-400 hover:text-ink"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AdminInlineSkeleton rows={8} />
        </div>
      ) : isError || !product ? (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-[8px] text-[13px] text-red-600">
            <AlertTriangle className="h-[16px] w-[16px]" aria-hidden />
            Couldn&rsquo;t load this product.
          </div>
        </div>
      ) : (
        <AddToInventoryForm product={product} onClose={onClose} />
      )}
    </>
  );
}

function AddToInventoryDrawer({
  productId,
  onClose,
}: {
  productId: string | null;
  onClose: () => void;
}) {
  if (!productId) return null;
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[720px] max-w-[95vw] flex-col bg-white shadow-2xl">
        <AddToInventoryDrawerContent key={productId} productId={productId} onClose={onClose} />
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
  const categoryFromUrl = search.get("category") ?? "";
  const brandFromUrl = search.get("brand") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  /* Category (any depth) + brand filter options */
  const categoriesQuery = useCategories({ shape: "tree", isActive: true });
  const brandsQuery = useBrands({ isActive: true, limit: 200 });
  const categoryOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All categories" },
      ...(categoriesQuery.data ? flattenCategoryTree(categoriesQuery.data) : []),
    ],
    [categoriesQuery.data],
  );
  const brandOptions = React.useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: "", label: "All brands" }];
    for (const b of brandsQuery.data?.data ?? []) opts.push({ value: b._id, label: b.name });
    return opts;
  }, [brandsQuery.data]);

  /* Which product rows have their size/variant stock breakdown expanded */
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* "Add to inventory" drawer - the product whose pricing/stock/variants
   * are currently being quick-edited, or null when closed. */
  const [inventoryDrawerProductId, setInventoryDrawerProductId] = React.useState<string | null>(
    null,
  );

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
      category: categoryFromUrl || undefined,
      brand: brandFromUrl || undefined,
      page,
      limit: 20,
    }),
    [status, sort, qFromUrl, categoryFromUrl, brandFromUrl, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminProducts(params);
  const products = data?.data.products ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive =
    status !== "all" ||
    Boolean(qFromUrl) ||
    Boolean(categoryFromUrl) ||
    Boolean(brandFromUrl) ||
    sort !== "newest";

  /* Clear selection + collapse expanded rows when page/filters change */
  React.useEffect(() => {
    setSelectedIds(new Set());
    setExpandedIds(new Set());
  }, [status, sort, qFromUrl, categoryFromUrl, brandFromUrl, page]);

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
      <div className={cn("flex flex-col gap-[16px]", selectedCount > 0 && "pb-[80px] sm:pb-0")}>
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-[12px]">
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-gray-900 sm:text-[24px]">Products</h1>
            <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">
              Toggle visibility, feature standouts, or remove items from the
              catalog.
            </p>
          </div>
          <div className="flex items-center gap-[8px]">
            {meta ? (
              <span className="text-[14px] text-gray-500">
                {meta.total.toLocaleString("en-US")} total
              </span>
            ) : null}
            <ExportCsvButton
              path="/admin/products/export.csv"
              params={{
                status: status !== "all" ? status : undefined,
                sort,
                q: qFromUrl || undefined,
                category: categoryFromUrl || undefined,
                brand: brandFromUrl || undefined,
              }}
              disabled={!meta || meta.total === 0}
            />
            {/* Flowbite primary button */}
            <Link
              href="/admin/products/new"
              className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
            >
              <Plus className="h-[16px] w-[16px]" aria-hidden /> New product
            </Link>
          </div>
        </header>

        {/* Status tabs - Flowbite underline tabs */}
        <AdminTabs
          ariaLabel="Product status filter"
          items={STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={status}
          onChange={(v) => updateUrl({ status: v === "all" ? undefined : v })}
        />

        {/* Inventory KPI strip - see InventoryStatsSection's own docs */}
        <InventoryStatsSection />

        {/* Filter bar - Flowbite table toolbar */}
        <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
          <form onSubmit={onSubmitSearch} className="flex w-full min-w-0 flex-1 items-center gap-[8px]">
            <label htmlFor="products-search" className="sr-only">Search products</label>
            <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
                <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
              </div>
              <Input id="products-search" type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Title or slug" className="pl-[36px]" />
            </div>
            <button
              type="submit"
              className="h-[40px] shrink-0 rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
            >
              Find
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-[12px] lg:ml-auto lg:shrink-0 lg:justify-end">
            <div className="flex items-center gap-[8px]">
              <label htmlFor="products-category" className="text-[13px] font-medium text-gray-500">Category</label>
              <Select
                id="products-category"
                value={categoryFromUrl}
                onChange={(e) => updateUrl({ category: e.target.value || undefined })}
                options={categoryOptions}
                disabled={categoriesQuery.isLoading}
              />
            </div>
            <div className="flex items-center gap-[8px]">
              <label htmlFor="products-brand" className="text-[13px] font-medium text-gray-500">Brand</label>
              <Select
                id="products-brand"
                value={brandFromUrl}
                onChange={(e) => updateUrl({ brand: e.target.value || undefined })}
                options={brandOptions}
                disabled={brandsQuery.isLoading}
              />
            </div>
            <div className="flex items-center gap-[8px]">
              <label htmlFor="products-sort" className="text-[13px] font-medium text-gray-500">Sort</label>
              <Select id="products-sort" value={sort} onChange={(e) => updateUrl({ sort: e.target.value })} options={SORT_OPTIONS} />
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => router.replace(pathname, { scroll: false })}
                className="inline-flex h-[40px] items-center gap-[6px] rounded-[8px] border border-gray-200 bg-white px-[12px] text-[13px] font-medium text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-[14px] w-[14px]" aria-hidden /> Clear
              </button>
            ) : null}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <AdminListSkeleton rows={10} columns={7} withThumb withCheckbox />
        ) : isError ? (
          <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
            <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
            <p className="text-[14px] text-gray-500">
              {error instanceof AdminError
                ? error.message
                : "Couldn't load products."}
            </p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[56px] text-center">
            <Package className="h-[32px] w-[32px] text-gray-300" aria-hidden />
            <div>
              <p className="text-[14px] font-medium text-gray-600">
                {filtersActive
                  ? "No products match these filters."
                  : "No products yet."}
              </p>
              {!filtersActive && (
                <p className="mt-[4px] text-[14px] text-gray-400">
                  Add your first product to start selling.
                </p>
              )}
            </div>
            {!filtersActive && (
              <Link
                href="/admin/products/new"
                className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
              >
                <Plus className="h-[16px] w-[16px]" aria-hidden /> Add first product
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile - native-app card list */}
            <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:hidden">
              <button
                type="button"
                onClick={toggleAll}
                className="flex w-full items-center gap-[8px] border-b border-gray-100 bg-gray-50 px-[16px] py-[10px] text-[13px] font-medium text-gray-600"
              >
                {allOnPageSelected ? (
                  <CheckSquare className="h-[18px] w-[18px] text-[#1A56DB]" aria-hidden />
                ) : someOnPageSelected ? (
                  <CheckSquare className="h-[18px] w-[18px] text-blue-300" aria-hidden />
                ) : (
                  <Square className="h-[18px] w-[18px]" aria-hidden />
                )}
                {allOnPageSelected ? "Deselect all" : "Select all on page"}
              </button>
              <div className="divide-y divide-gray-100">
                {products.map((p) => (
                  <ProductCardMobile
                    key={p._id}
                    product={p}
                    selected={selectedIds.has(p._id)}
                    onToggleSelect={() => toggleOne(p._id)}
                    expanded={expandedIds.has(p._id)}
                    onToggleExpand={() => toggleExpanded(p._id)}
                    onOpenInventory={setInventoryDrawerProductId}
                  />
                ))}
              </div>
            </div>

            {/* Desktop / tablet - full table */}
            <div className="hidden overflow-x-auto rounded-[8px] border border-gray-200 bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="w-8 px-[8px] py-[12px] align-middle">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="flex items-center text-gray-400 transition duration-75 hover:text-gray-900"
                        aria-label={allOnPageSelected ? "Deselect all on page" : "Select all on page"}
                      >
                        {allOnPageSelected ? (
                          <CheckSquare className="h-[16px] w-[16px] text-[#1A56DB]" aria-hidden />
                        ) : someOnPageSelected ? (
                          <CheckSquare className="h-[16px] w-[16px] text-blue-300" aria-hidden />
                        ) : (
                          <Square className="h-[16px] w-[16px]" aria-hidden />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Product
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      SKU
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Category
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Price
                    </th>
                    <th
                      className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400"
                      title="All-time units sold across delivered/returned orders - this store has no supplier purchase-order tracking, so this stands in for a 'purchased' figure."
                    >
                      Purch. Qty
                    </th>
                    <th
                      className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400"
                      title="Current stock on hand"
                    >
                      Curr. Qty
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Variants
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {products.map((p) => (
                    <ProductRow
                      key={p._id}
                      product={p}
                      selected={selectedIds.has(p._id)}
                      onToggleSelect={() => toggleOne(p._id)}
                      expanded={expandedIds.has(p._id)}
                      onToggleExpand={() => toggleExpanded(p._id)}
                      onOpenInventory={setInventoryDrawerProductId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
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

      {/* Bulk action bar — full-width bottom bar on mobile, centered floating
          pill from sm up. */}
      {selectedCount > 0 ? (
        <div className="fixed inset-x-[12px] bottom-[12px] z-30 sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:-translate-x-1/2">
          <div className="flex items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white px-[16px] py-[12px] shadow-xl sm:px-[20px]">
            <span className="shrink-0 text-[13px] font-medium tabular-nums text-gray-900 sm:text-[14px]">
              {selectedCount} <span className="hidden xs:inline">product{selectedCount !== 1 ? "s" : ""}</span> selected
            </span>
            <div className="hidden h-[16px] w-px bg-gray-200 sm:block" aria-hidden />
            {/* Flowbite alternative button */}
            <button
              type="button"
              onClick={() => setBulkPanelOpen(true)}
              className="inline-flex h-[36px] flex-1 items-center justify-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100 sm:flex-none"
            >
              <Ruler className="h-[16px] w-[16px]" aria-hidden />
              <span className="hidden xs:inline">Apply size chart</span>
              <span className="xs:hidden">Size chart</span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Clear selection"
            >
              <X className="h-[16px] w-[16px]" aria-hidden />
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

      {/* Add to inventory drawer */}
      <AddToInventoryDrawer
        productId={inventoryDrawerProductId}
        onClose={() => setInventoryDrawerProductId(null)}
      />
    </>
  );
}


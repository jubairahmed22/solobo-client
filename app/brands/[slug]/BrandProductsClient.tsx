"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ProductCard,
  ProductCardSkeleton,
  FilterRail,
  SortBar,
  Pagination,
  Breadcrumb,
  type FilterValue,
  type Crumb,
} from "@/components/composed";
import { Drawer } from "@/components/complex";
import { Button } from "@/components/ui";
import { ArrowUpDown, Check, SlidersHorizontal } from "lucide-react";
import { useProducts, useCategories } from "@/hooks/useCatalog";
import type { BrandDetail, ProductSort, ProductSummary } from "@/types/catalog";

const PAGE_SIZE = 24;

export interface BrandProductsClientProps {
  brandSlug: string;
  brandName: string;
  brandDescription?: string;
  crumbs: Crumb[];
  initialProducts: ProductSummary[];
  brands: BrandDetail[];
}

/**
 * Brand listing - same Flipkart-style layout as /all-products and
 * /category/[...slug]: a white filter sidebar beside a white content panel
 * (breadcrumb → heading + count → sort tabs → product grid). The brand is
 * locked in the filter rail (picking a different one navigates); category,
 * price, rating and stock stay fully filterable. Hydrates from SSR'd
 * products so first paint is instant + SEO-friendly.
 */
export function BrandProductsClient({
  brandSlug,
  brandName,
  brandDescription,
  crumbs,
  initialProducts,
  brands,
}: BrandProductsClientProps) {
  const router = useRouter();
  const params = useSearchParams();

  const page = Number(params.get("page") ?? "1") || 1;
  const sort = (params.get("sort") as ProductSort | null) ?? "newest";
  const filters: FilterValue = {
    brandSlug, // locked - filter rail won't change this on a brand page
    categoryPath: params.get("category") ?? undefined,
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    minRating: params.get("minRating") ? Number(params.get("minRating")) : undefined,
    inStock: params.get("inStock") === "1" || undefined,
  };

  const usingInitial =
    page === 1 &&
    sort === "newest" &&
    !filters.categoryPath &&
    filters.minPrice === undefined &&
    filters.maxPrice === undefined &&
    filters.minRating === undefined &&
    !filters.inStock;

  const { data: productResp, isLoading } = useProducts({
    sort,
    page,
    limit: PAGE_SIZE,
    brandSlug: filters.brandSlug,
    categoryPath: filters.categoryPath,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    inStock: filters.inStock,
  });

  const { data: categoryTree } = useCategories({ shape: "tree", isActive: true });

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);

  const sortOptions: Array<{ label: string; value: ProductSort }> = [
    { label: "Newest First", value: "newest" },
    { label: "Popularity", value: "popular" },
    { label: "Price: Low to High", value: "price-asc" },
    { label: "Price: High to Low", value: "price-desc" },
  ];

  const setSearchParam = React.useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      router.push(`/brands/${brandSlug}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, router, brandSlug],
  );

  const onFilterChange = (next: FilterValue) => {
    // brandSlug is locked on this page - picking a different brand navigates.
    if (next.brandSlug && next.brandSlug !== brandSlug) {
      router.push(`/brands/${next.brandSlug}`);
      return;
    }
    setSearchParam({
      category: next.categoryPath,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
      minRating: next.minRating,
      inStock: next.inStock ? "1" : undefined,
      page: undefined,
    });
  };

  const onSortChange = (s: ProductSort) => setSearchParam({ sort: s, page: undefined });
  const onPageChange = (p: number) => {
    setSearchParam({ page: p });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const products = productResp?.data ?? (usingInitial ? initialProducts : []);
  const meta = productResp?.meta;
  const maxObservedPrice = products.reduce((m, p) => Math.max(m, p.compareAtPrice ?? p.price), 0);

  const countLine = meta
    ? `Showing ${meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}–${Math.min(
        meta.page * meta.limit,
        meta.total,
      )} products of ${meta.total.toLocaleString("en-IN")} products`
    : products.length > 0
      ? `${products.length} products`
      : "";

  const filterRail = (extra?: () => void) => (
    <FilterRail
      value={filters}
      onChange={(next) => {
        onFilterChange(next);
        extra?.();
      }}
      categories={categoryTree ?? []}
      brands={brands}
      maxObservedPrice={maxObservedPrice}
    />
  );

  return (
    <>
      {/* Desktop filter sidebar */}
      <aside className="hidden w-[260px] shrink-0 md:block">
        <div className="sticky top-2 rounded bg-white">{filterRail()}</div>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 sm:rounded sm:bg-white sm:p-3">
        <div className="px-2 pt-2 sm:px-0 sm:pt-0">
          <Breadcrumb items={crumbs} />

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{brandName}</h1>
            {countLine ? <span className="text-sm text-neutral-500">({countLine})</span> : null}
          </div>
          {brandDescription ? (
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">{brandDescription}</p>
          ) : null}

          <div className="mt-2 hidden items-center gap-2 sm:flex">
            <Button
              variant="secondary"
              size="sm"
              className="md:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-1.5">Filters</span>
            </Button>
            <SortBar value={sort} onChange={onSortChange} className="flex-1" />
          </div>
        </div>

        <ul className="mt-1.5 grid grid-cols-2 gap-[8px] px-[8px] sm:grid-cols-3 sm:gap-2 sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
          {isLoading && !usingInitial
            ? Array.from({ length: 12 }).map((_, i) => (
                <li key={i} className="flex flex-col">
                  <ProductCardSkeleton className="h-full w-full" />
                </li>
              ))
            : products.map((p) => (
                <li key={p._id} className="flex flex-col">
                  <ProductCard product={p} className="h-full w-full" />
                </li>
              ))}
        </ul>

        {!isLoading && products.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-paper py-6 text-center">
            <p className="text-base font-medium">No products from {brandName} yet.</p>
            <p className="text-sm text-neutral-600">
              Try clearing filters or browse another brand.
            </p>
          </div>
        ) : null}

        {meta && meta.totalPages > 1 ? (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
            className="mt-3"
          />
        ) : null}
      </div>

      {/* Mobile bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)] sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex h-14 flex-1 items-center justify-center gap-2 border-r border-neutral-200 text-sm font-semibold text-ink transition-colors active:bg-neutral-100"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {[filters.categoryPath, filters.minPrice, filters.maxPrice, filters.minRating, filters.inStock].filter(Boolean).length > 0 ? (
            <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-paper">
              {[filters.categoryPath, filters.minPrice, filters.maxPrice, filters.minRating, filters.inStock].filter(Boolean).length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="flex h-14 flex-1 items-center justify-center gap-2 text-sm font-semibold text-ink transition-colors active:bg-neutral-100"
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden />
          Sort
        </button>
      </div>

      {/* Mobile filter drawer */}
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} side="left" title="Filters">
        {filterRail(() => setFiltersOpen(false))}
      </Drawer>

      {/* Mobile sort bottom sheet */}
      <Drawer open={sortOpen} onClose={() => setSortOpen(false)} side="bottom" title="Sort By">
        <ul className="px-4 py-2">
          {sortOptions.map((opt) => {
            const active = sort === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                  className={`flex w-full items-center justify-between border-b border-neutral-100 py-4 text-sm last:border-0 ${active ? "font-semibold text-accent" : "text-ink"}`}
                >
                  <span>{opt.label}</span>
                  <span className={`h-5 w-5 rounded-full border-2 transition-colors ${active ? "border-accent bg-accent" : "border-neutral-300"}`}>
                    {active ? <Check className="h-full w-full p-0.5 text-white" aria-hidden /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}

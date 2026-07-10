"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar, Footer } from "@/components/layout";
import {
  ProductCard,
  ProductCardSkeleton,
  FilterRail,
  SortBar,
  Pagination,
  Breadcrumb,
  type FilterValue,
} from "@/components/composed";
import { Drawer } from "@/components/complex";
import { Button } from "@/components/ui";
import { SlidersHorizontal, ArrowUpDown, Check } from "lucide-react";
import { useProducts, useCategories, useBrands } from "@/hooks/useCatalog";
import type { CategoryTreeNode, ProductSort } from "@/types/catalog";

const PAGE_SIZE = 24;

/** Find a category node's display name by its path (depth-first). */
function findCategoryName(nodes: CategoryTreeNode[], path?: string): string | undefined {
  if (!path) return undefined;
  for (const n of nodes) {
    if (n.path === path) return n.name;
    const inner = findCategoryName(n.children ?? [], path);
    if (inner) return inner;
  }
  return undefined;
}

function AllProductsContent() {
  const router = useRouter();
  const params = useSearchParams();

  // Read filters/pagination from the URL so deep-linking and refresh "just work".
  const q = params.get("q") ?? undefined;
  const page = Number(params.get("page") ?? "1") || 1;
  const sort = (params.get("sort") as ProductSort | null) ?? (q ? "relevance" : "popular");
  // Tags arrive as a comma-separated value (the backend treats the string as
  // an OR list). PDP tag chips link with a single tag; multi-select filtering
  // can join with commas later without breaking the URL contract.
  const tags = params.get("tags") ?? undefined;
  const filters: FilterValue = {
    categoryPath: params.get("category") ?? undefined,
    brandSlug: params.get("brand") ?? undefined,
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    minRating: params.get("minRating") ? Number(params.get("minRating")) : undefined,
    inStock: params.get("inStock") === "1" || undefined,
  };

  const { data: productResp, isLoading } = useProducts({
    q,
    sort,
    page,
    limit: PAGE_SIZE,
    categoryPath: filters.categoryPath,
    brandSlug: filters.brandSlug,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    inStock: filters.inStock,
    tags,
  });
  const { data: categoryTree } = useCategories({ shape: "tree", isActive: true });
  const { data: brandResp } = useBrands({ isActive: true, limit: 100 });

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);

  const setSearchParam = React.useCallback(
    (patch: Record<string, string | number | undefined | null | boolean>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "" || v === false) next.delete(k);
        else next.set(k, String(v));
      }
      router.push(`/all-products?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const onFilterChange = (next: FilterValue) => {
    setSearchParam({
      category: next.categoryPath,
      brand: next.brandSlug,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
      minRating: next.minRating,
      inStock: next.inStock ? "1" : undefined,
      page: undefined, // reset pagination on filter change
    });
  };

  const onSortChange = (s: ProductSort) => setSearchParam({ sort: s, page: undefined });
  const onPageChange = (p: number) => {
    setSearchParam({ page: p });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const products = productResp?.data ?? [];
  const meta = productResp?.meta;
  const tree = categoryTree ?? [];

  // Slider bound from the prices actually on screen (incl. strikethrough).
  const maxObservedPrice = products.reduce(
    (m, p) => Math.max(m, p.compareAtPrice ?? p.price),
    0,
  );

  // Heading: active category name → search term → "All products".
  const categoryName = findCategoryName(tree, filters.categoryPath);
  const heading = categoryName ?? (q ? `Search: ${q}` : "All products");

  // "Showing X–Y products of TOTAL" line.
  const countLine = meta
    ? `Showing ${meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}–${Math.min(
        meta.page * meta.limit,
        meta.total,
      )} products of ${meta.total.toLocaleString("en-IN")} products`
    : "";

  const activeFiltersCount = [
    filters.categoryPath,
    filters.brandSlug,
    filters.minPrice,
    filters.maxPrice,
    filters.minRating,
    filters.inStock,
  ].filter(Boolean).length;

  const sortOptions: Array<{ label: string; value: ProductSort }> = [
    { label: "Popularity", value: "popular" },
    { label: "Price: Low to High", value: "price-asc" },
    { label: "Price: High to Low", value: "price-desc" },
    { label: "Newest First", value: "newest" },
    ...(q ? [{ label: "Relevance", value: "relevance" as ProductSort }] : []),
  ];

  const crumbs = [
    { label: "Home", href: "/" },
    ...(categoryName
      ? [{ label: categoryName }]
      : [{ label: q ? `Results for "${q}"` : "All products" }]),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-ink">
      <Navbar />
      <main className="mx-auto flex w-full flex-1 gap-2 px-0 py-1 pb-16 sm:px-4 sm:py-2 sm:pb-2 md:px-6 lg:w-[82%]">
        {/* Desktop filter sidebar */}
        <aside className="hidden w-[260px] shrink-0 md:block">
          <div className="sticky top-2 rounded bg-white">
            <FilterRail
              value={filters}
              onChange={onFilterChange}
              categories={tree}
              brands={brandResp?.data ?? []}
              maxObservedPrice={maxObservedPrice}
            />
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 sm:rounded sm:bg-white sm:p-3">
          <div className="px-2 pt-2 sm:px-0 sm:pt-0">
            <Breadcrumb items={crumbs} />

            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{heading}</h1>
              {countLine ? <span className="text-sm text-neutral-500">({countLine})</span> : null}
            </div>

            {/* Sort + filter row — hidden on mobile (bottom bar handles it) */}
            <div className="mt-2 hidden sm:flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="md:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                <span className="ml-1.5">Filters</span>
              </Button>
              <SortBar value={sort} onChange={onSortChange} showRelevance={!!q} className="flex-1" />
            </div>
          </div>

          <ul className="mt-1.5 grid grid-cols-2 gap-[8px] px-[8px] sm:grid-cols-3 sm:gap-2 sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
            {isLoading
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
              <p className="text-base font-medium">No products match those filters.</p>
              <p className="text-sm text-neutral-600">
                Try clearing some filters or searching for something else.
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
      </main>
      <Footer />

      {/* Mobile bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)] sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex h-14 flex-1 items-center justify-center gap-2 border-r border-neutral-200 text-sm font-semibold text-ink transition-colors active:bg-neutral-100"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {activeFiltersCount > 0 ? (
            <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-paper">
              {activeFiltersCount}
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
        <FilterRail
          value={filters}
          onChange={(next) => {
            onFilterChange(next);
            setFiltersOpen(false);
          }}
          categories={tree}
          brands={brandResp?.data ?? []}
          maxObservedPrice={maxObservedPrice}
        />
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
                  onClick={() => {
                    onSortChange(opt.value);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between border-b border-neutral-100 py-4 text-sm last:border-0 ${active ? "font-semibold text-accent" : "text-ink"}`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`h-5 w-5 rounded-full border-2 transition-colors ${active ? "border-accent bg-accent" : "border-neutral-300"}`}
                  >
                    {active ? <Check className="h-full w-full p-0.5 text-white" aria-hidden /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </div>
  );
}

export default function AllProductsPage() {
  return (
    <React.Suspense fallback={null}>
      <AllProductsContent />
    </React.Suspense>
  );
}

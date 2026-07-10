"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { catalogApi } from "@/lib/api/catalog";
import type { ProductListQuery } from "@/types/catalog";

export const catalogKeys = {
  all: ["catalog"] as const,
  categories: (params?: object) => ["catalog", "categories", params ?? {}] as const,
  category: (slug: string) => ["catalog", "category", slug] as const,
  brands: (params?: object) => ["catalog", "brands", params ?? {}] as const,
  brand: (slug: string) => ["catalog", "brand", slug] as const,
  products: (params?: ProductListQuery) => ["catalog", "products", params ?? {}] as const,
  product: (slug: string) => ["catalog", "product", slug] as const,
  featured: (limit?: number) => ["catalog", "products", "featured", limit ?? 12] as const,
  related: (slug: string) => ["catalog", "products", "related", slug] as const,
  sellerStore: (slug: string, page: number, limit: number) =>
    ["catalog", "seller-store", slug, page, limit] as const,
  searchSuggest: (q: string) => ["catalog", "search-suggest", q] as const,
};

/* ───────────── Categories ───────────── */

export function useCategories(params?: { shape?: "tree" | "flat"; isActive?: boolean; search?: string }) {
  return useQuery({
    queryKey: catalogKeys.categories(params),
    queryFn: () => catalogApi.listCategories(params),
    staleTime: 5 * 60_000, // categories rarely change
  });
}

export function useCategory(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.category(slug ?? ""),
    queryFn: () => catalogApi.getCategory(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

/* ───────────── Brands ───────────── */

export function useBrands(params?: { search?: string; isActive?: boolean; isFeatured?: boolean; page?: number; limit?: number }) {
  return useQuery({
    queryKey: catalogKeys.brands(params),
    queryFn: () => catalogApi.listBrands(params),
    staleTime: 5 * 60_000,
  });
}

export function useBrand(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.brand(slug ?? ""),
    queryFn: () => catalogApi.getBrand(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

/* ───────────── Products ───────────── */

export function useProducts(params?: ProductListQuery) {
  return useQuery({
    queryKey: catalogKeys.products(params),
    queryFn: () => catalogApi.listProducts(params),
    placeholderData: keepPreviousData, // smooth pagination
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.product(slug ?? ""),
    queryFn: () => catalogApi.getProduct(slug!),
    enabled: !!slug,
  });
}

export function useFeaturedProducts(limit = 12) {
  return useQuery({
    queryKey: catalogKeys.featured(limit),
    queryFn: () => catalogApi.listFeaturedProducts(limit),
    staleTime: 60_000,
  });
}

export function useRelatedProducts(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.related(slug ?? ""),
    queryFn: () => catalogApi.listRelatedProducts(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

/* ───────────── Search suggest ───────────── */

/**
 * Predictive search hook used by the navbar typeahead.
 *
 * The caller passes the (debounced) raw input - we skip the fetch entirely
 * for inputs under 2 chars because (a) the suggest endpoint also bails for
 * short queries, (b) firing on every keystroke between 0-1 chars would
 * generate noise traffic.
 *
 * `placeholderData: keepPreviousData` keeps the last set of suggestions on
 * screen while a new query is in-flight, so the dropdown doesn't flash
 * empty between keystrokes.
 */
export function useSearchSuggest(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: catalogKeys.searchSuggest(trimmed),
    queryFn: () => catalogApi.searchSuggest(trimmed),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/* ───────────── Public seller storefront ───────────── */

export function useSellerStore(slug: string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: catalogKeys.sellerStore(slug ?? "", page, limit),
    queryFn: () => catalogApi.getSellerStore(slug!, { page, limit }),
    enabled: !!slug,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

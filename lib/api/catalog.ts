import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  CategoryTreeNode,
  CategoryDetail,
  BrandDetail,
  ProductSummary,
  ProductDetail,
  ProductListQuery,
  PublicSellerStore,
  SearchSuggestResponse,
} from "@/types/catalog";

/* ───────────── helpers ───────────── */

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (res.data.success) return res.data.data;
  throw new CatalogError(res.data.message, res.data.code ?? "ERROR");
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await promise;
  if (res.data.success) return { data: res.data.data, meta: res.data.meta };
  throw new CatalogError(res.data.message, res.data.code ?? "ERROR");
}

export class CatalogError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/* ───────────── API ───────────── */

export const catalogApi = {
  /* Categories */
  listCategories: (params?: { shape?: "tree" | "flat"; isActive?: boolean; search?: string }) =>
    unwrap<CategoryTreeNode[]>(apiClient.get("/categories", { params: { shape: "tree", ...params } })),

  getCategory: (slugOrPath: string) => {
    // Multi-segment paths (e.g. "face/lips/lipstick") need the wildcard
    // backend route - the default `:slug` route only captures a single
    // URL segment, so encoding the slash as %2F still 404s.
    if (slugOrPath.includes("/")) {
      return unwrap<CategoryDetail>(
        apiClient.get(`/categories/by-path/${slugOrPath}`),
      );
    }
    return unwrap<CategoryDetail>(
      apiClient.get(`/categories/${encodeURIComponent(slugOrPath)}`),
    );
  },

  /* Brands */
  listBrands: (params?: {
    search?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    /** Single uppercase letter A–Z, or "#" for digits/symbols. */
    letter?: string;
    page?: number;
    limit?: number;
  }) =>
    unwrapWithMeta<BrandDetail[]>(apiClient.get("/brands", { params })),

  getBrand: (slug: string) =>
    unwrap<BrandDetail>(apiClient.get(`/brands/${encodeURIComponent(slug)}`)),

  /* Products */
  listProducts: (params?: ProductListQuery) =>
    unwrapWithMeta<ProductSummary[]>(apiClient.get("/products", { params })),

  getProduct: (slug: string) =>
    unwrap<ProductDetail>(apiClient.get(`/products/${encodeURIComponent(slug)}`)),

  listFeaturedProducts: (limit = 12) =>
    unwrap<ProductSummary[]>(apiClient.get("/products/featured", { params: { limit } })),

  listRelatedProducts: (slug: string) =>
    unwrap<ProductSummary[]>(apiClient.get(`/products/related/${encodeURIComponent(slug)}`)),

  /** Predictive search + spell-correction. Used by the navbar typeahead and
   *  the /all-products "did you mean" hint. */
  searchSuggest: (q: string) =>
    unwrap<SearchSuggestResponse>(
      apiClient.get("/products/suggest", { params: { q } }),
    ),

  /* Public seller storefront */
  getSellerStore: (slug: string, params?: { page?: number; limit?: number }) =>
    unwrapWithMeta<PublicSellerStore>(
      apiClient.get(`/sellers/${encodeURIComponent(slug)}`, { params }),
    ),
};

"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sellerApi } from "@/lib/api/seller";
import type {
  SellerListOrdersParams,
  SellerListProductsParams,
  SellerProductCreate,
  SellerProductPatch,
  SellerProfilePatch,
} from "@/types/seller";
import type { OrderStatus } from "@/types/commerce";

export const sellerKeys = {
  stats: ["seller", "stats"] as const,
  timeseries: (days: number) => ["seller", "stats", "timeseries", days] as const,
  timeseriesAll: ["seller", "stats", "timeseries"] as const,
  profile: ["seller", "profile"] as const,
  products: (params: SellerListProductsParams) =>
    ["seller", "products", params] as const,
  productsAll: ["seller", "products"] as const,
  product: (id: string) => ["seller", "product", id] as const,
  orders: (params: SellerListOrdersParams) =>
    ["seller", "orders", params] as const,
  ordersAll: ["seller", "orders"] as const,
  order: (id: string) => ["seller", "order", id] as const,
};

export function useSellerStats() {
  return useQuery({
    queryKey: sellerKeys.stats,
    queryFn: sellerApi.getStats,
    staleTime: 30_000,
  });
}

/**
 * Daily sales time-series for the seller dashboard chart. Keyed by the
 * `days` window so 7d/30d/90d don't clobber each other - re-toggling
 * past windows returns instantly from cache. Same 30s staleTime as
 * the KPI block; checkouts that affect the chart also invalidate
 * `sellerKeys.stats`, and the chart hook listens to a broader
 * `timeseries` prefix so all open windows refresh together.
 */
export function useSellerTimeseries(days: number) {
  return useQuery({
    queryKey: sellerKeys.timeseries(days),
    queryFn: () => sellerApi.getTimeseries(days),
    staleTime: 30_000,
  });
}

/* ───────────────────── Storefront profile ───────────────────── */

/**
 * Read the seller's storefront slice (name/slug/bio/avatar). Used by the
 * /seller/settings page to seed the form. We keep this 30s stale so the
 * settings form picks up an external change (e.g. the lazy slug mint that
 * happens on first product publish) without hammering the API.
 */
export function useSellerProfile() {
  return useQuery({
    queryKey: sellerKeys.profile,
    queryFn: sellerApi.getProfile,
    staleTime: 30_000,
  });
}

/**
 * Mutate the storefront profile. On success we invalidate:
 *  - the profile cache itself (so the open form sees its own write)
 *  - the seller stats card (the dashboard header shows the storefront link)
 *  - any cached storefront page keyed on the old slug - `["seller-store"]`
 *    is wiped wholesale because the slug change makes the old key stale.
 *  - the product detail cache, since "Sold by" panels render the slug.
 *
 * The Redis cache on the public `/api/sellers/:slug` route still holds for
 * up to 120s after a slug change - that's an accepted UX wrinkle since the
 * sparse-unique index guarantees the old slug can't be reused by anyone
 * else in that window, so callers landing on the stale URL just get a 404
 * once the cache flushes.
 */
export function useUpdateSellerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SellerProfilePatch) => sellerApi.updateProfile(patch),
    onSuccess: (next) => {
      qc.setQueryData(sellerKeys.profile, next);
      qc.invalidateQueries({ queryKey: sellerKeys.stats });
      qc.invalidateQueries({ queryKey: ["seller-store"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
  });
}

/* ───────────────────── Products ───────────────────── */

export function useSellerProducts(params: SellerListProductsParams) {
  return useQuery({
    queryKey: sellerKeys.products(params),
    queryFn: () => sellerApi.listProducts(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useSellerProduct(id: string | undefined) {
  return useQuery({
    queryKey: id ? sellerKeys.product(id) : ["seller", "product", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Product id is required");
      return sellerApi.getProduct(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Product mutations invalidate:
 *  - the specific product detail (so the open editor refetches)
 *  - every seller/products list query (the dashboard list reflects the change)
 *  - seller/stats (the products.active counter)
 *  - the storefront `products` and `product` keys (the storefront cache TTL
 *    will still hold for up to 120s, but the in-flight React Query state on
 *    the public side is now invalidated so the next refetch picks it up).
 *  - the admin counterparts too - an admin watching alongside should see
 *    the seller's edit propagate without a manual refresh.
 */
function useInvalidateProduct(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: sellerKeys.product(id) });
    qc.invalidateQueries({ queryKey: sellerKeys.productsAll });
    qc.invalidateQueries({ queryKey: sellerKeys.stats });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["admin", "product"] });
    qc.invalidateQueries({ queryKey: ["admin", "stats"] });
  };
}

export function useCreateSellerProduct() {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (body: SellerProductCreate) => sellerApi.createProduct(body),
    onSuccess: invalidate,
  });
}

export function useUpdateSellerProduct(id: string) {
  const invalidate = useInvalidateProduct(id);
  return useMutation({
    mutationFn: (patch: SellerProductPatch) => sellerApi.updateProduct(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteSellerProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sellerApi.deleteProduct(id),
    onSuccess: () => {
      // The deleted detail entry is now a 404 - wipe the whole `product`
      // key prefix so any cached singular entries also get evicted.
      qc.invalidateQueries({ queryKey: sellerKeys.productsAll });
      qc.invalidateQueries({ queryKey: ["seller", "product"] });
      qc.invalidateQueries({ queryKey: sellerKeys.stats });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "product"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/* ───────────────────── Orders ───────────────────── */

export function useSellerOrders(params: SellerListOrdersParams) {
  return useQuery({
    queryKey: sellerKeys.orders(params),
    queryFn: () => sellerApi.listOrders(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useSellerOrder(id: string | undefined) {
  return useQuery({
    queryKey: id ? sellerKeys.order(id) : ["seller", "order", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Order id is required");
      return sellerApi.getOrder(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Order mutations touch:
 *  - the specific seller-projected order detail (so the open page refetches
 *    through `/seller/orders/:id` and re-applies the per-seller scrub)
 *  - every seller/orders list query (the queue reflects the new status)
 *  - seller/stats (pendingFulfilment + recentOrders both shift)
 *  - the admin counterparts so any cross-watching admin sees it
 *  - the customer-facing `orders` key prefix so a customer with the order
 *    open in another tab picks up the new status on next refocus.
 */
function useInvalidateSellerOrder(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: sellerKeys.order(id) });
    qc.invalidateQueries({ queryKey: sellerKeys.ordersAll });
    qc.invalidateQueries({ queryKey: sellerKeys.stats });
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    qc.invalidateQueries({ queryKey: ["admin", "order"] });
    qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
}

export function useUpdateSellerOrderStatus(id: string) {
  const invalidate = useInvalidateSellerOrder(id);
  return useMutation({
    mutationFn: (input: { status: OrderStatus; note?: string }) =>
      sellerApi.updateOrderStatus(id, input.status, input.note),
    onSuccess: invalidate,
  });
}

export function useUpdateSellerOrderTracking(id: string) {
  const invalidate = useInvalidateSellerOrder(id);
  return useMutation({
    mutationFn: (patch: {
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    }) => sellerApi.updateOrderTracking(id, patch),
    onSuccess: invalidate,
  });
}

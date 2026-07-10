"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import type {
  AdminAddOrderItemInput,
  AdminBrandCreate,
  AdminBrandPatch,
  AdminCategoryCreate,
  AdminCategoryPatch,
  AdminCreatePosOrderInput,
  AdminListAuditEventsParams,
  AdminListBrandsParams,
  AdminListCategoriesParams,
  AdminListOrdersParams,
  AdminListProductsParams,
  AdminListReviewsParams,
  AdminListUsersParams,
  AdminPatchOrderCustomerInput,
  AdminProductCreate,
  AdminProductPatch,
  AdminUpdateOrderItemInput,
  AdminUserRolePatch,
  AdminUserStatusPatch,
} from "@/types/admin";
import type { OrderStatus, PaymentStatus } from "@/types/commerce";
import type { AdminListQuestionsParams } from "@/types/questions";

export const adminKeys = {
  stats: ["admin", "stats"] as const,
  timeseries: (days: number, sellerId?: string) =>
    sellerId
      ? (["admin", "stats", "timeseries", days, sellerId] as const)
      : (["admin", "stats", "timeseries", days] as const),
  timeseriesAll: ["admin", "stats", "timeseries"] as const,
  reviews: (params: AdminListReviewsParams) => ["admin", "reviews", params] as const,
  reviewsAll: ["admin", "reviews"] as const,
  orders: (params: AdminListOrdersParams) => ["admin", "orders", params] as const,
  ordersAll: ["admin", "orders"] as const,
  order: (id: string) => ["admin", "order", id] as const,
  products: (params: AdminListProductsParams) => ["admin", "products", params] as const,
  productsAll: ["admin", "products"] as const,
  product: (id: string) => ["admin", "product", id] as const,
  users: (params: AdminListUsersParams) => ["admin", "users", params] as const,
  usersAll: ["admin", "users"] as const,
  user: (id: string) => ["admin", "user", id] as const,
  categories: (params: AdminListCategoriesParams) =>
    ["admin", "categories", params] as const,
  categoriesAll: ["admin", "categories"] as const,
  category: (id: string) => ["admin", "category", id] as const,
  brands: (params: AdminListBrandsParams) => ["admin", "brands", params] as const,
  brandsAll: ["admin", "brands"] as const,
  brand: (id: string) => ["admin", "brand", id] as const,
  audit: (params: AdminListAuditEventsParams) =>
    ["admin", "audit", params] as const,
  auditAll: ["admin", "audit"] as const,
  questions: (params: AdminListQuestionsParams) =>
    ["admin", "questions", params] as const,
  questionsAll: ["admin", "questions"] as const,
  siteSettings: ["admin", "site-settings"] as const,
  customizations: ["admin", "customizations"] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: adminApi.getStats,
    staleTime: 30_000,
  });
}

/**
 * Platform-wide daily sales time-series for the admin dashboard chart.
 * Keyed by the `days` window so 7d/30d/90d don't clobber each other, and
 * by `sellerId` when the admin drills into a single seller's slice.
 * Same 30s staleTime as the KPI block.
 */
export function useAdminTimeseries(days: number, sellerId?: string) {
  return useQuery({
    queryKey: adminKeys.timeseries(days, sellerId),
    queryFn: () => adminApi.getTimeseries(days, sellerId),
    staleTime: 30_000,
  });
}

export function useAdminReviews(params: AdminListReviewsParams) {
  return useQuery({
    queryKey: adminKeys.reviews(params),
    queryFn: () => adminApi.listReviews(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/**
 * Wrapper around the moderation actions. Each invalidation pass refreshes:
 *  - every admin/reviews list query (so the queue reflects the new state)
 *  - admin/stats (so the "pending reviews" KPI tile updates)
 *  - the public-side `reviews` keys (so the storefront product page picks
 *    up the new approval state without a manual refresh).
 */
function useInvalidateAfterModeration() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.reviewsAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["reviews"] });
  };
}

export function useApproveReview() {
  const invalidate = useInvalidateAfterModeration();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveReview(id),
    onSuccess: invalidate,
  });
}

export function useHideReview() {
  const invalidate = useInvalidateAfterModeration();
  return useMutation({
    mutationFn: (id: string) => adminApi.hideReview(id),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminReview() {
  const invalidate = useInvalidateAfterModeration();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteReview(id),
    onSuccess: invalidate,
  });
}

/* ───────────────────── Orders ───────────────────── */

export function useAdminOrders(params: AdminListOrdersParams) {
  return useQuery({
    queryKey: adminKeys.orders(params),
    queryFn: () => adminApi.listOrders(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminOrder(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminKeys.order(id) : ["admin", "order", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Order id is required");
      return adminApi.getOrder(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Order mutations all touch:
 *  - the specific order's detail key (so the open detail page refreshes)
 *  - every admin/orders list query (so the table reflects the new state)
 *  - admin/stats (so the order-status KPI tiles update)
 *  - the customer-facing `orders` keys (so a user looking at their own order
 *    list sees the change without a manual refresh)
 */
function useInvalidateOrder(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.order(id) });
    qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
}

export function useUpdateOrderStatus(id: string) {
  const invalidate = useInvalidateOrder(id);
  return useMutation({
    mutationFn: (input: { status: OrderStatus; note?: string }) =>
      adminApi.updateOrderStatus(id, input.status, input.note),
    onSuccess: invalidate,
  });
}

export function useCancelAdminOrder(id: string) {
  const invalidate = useInvalidateOrder(id);
  return useMutation({
    mutationFn: (reason?: string) => adminApi.cancelOrder(id, reason),
    onSuccess: invalidate,
  });
}

/** Hard-delete an order. The detail page redirects on success, so this only
 *  needs to refresh the list queries. */
export function useDeleteAdminOrder(id: string) {
  const invalidate = useInvalidateOrder(id);
  return useMutation({
    mutationFn: () => adminApi.deleteOrder(id),
    onSuccess: invalidate,
  });
}

export function useUpdateOrderPayment(id: string) {
  const invalidate = useInvalidateOrder(id);
  return useMutation({
    mutationFn: (input: {
      status: PaymentStatus;
      transactionId?: string;
      refundAmount?: number;
    }) => adminApi.updatePayment(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateOrderTracking(id: string) {
  const invalidate = useInvalidateOrder(id);
  return useMutation({
    mutationFn: (patch: {
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    }) => adminApi.updateTracking(id, patch),
    onSuccess: invalidate,
  });
}

/* ─── Admin order line-item mutations + customer edit + POS create ───
 *
 * Each mutation reuses {@link useInvalidateOrder} so the open detail page,
 * every admin/orders list query, the stats KPIs, and the customer-facing
 * `orders` key all refresh together. Adding/removing items also touches
 * the storefront `products` and `product` keys because we're decrementing
 * (or restoring) inventory atomically and the catalog cache + open PDP
 * should reflect the new stock level on next refetch.
 */

function useInvalidateOrderWithCatalog(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.order(id) });
    qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
    qc.invalidateQueries({ queryKey: adminKeys.productsAll });
  };
}

export function useAddAdminOrderItem(id: string) {
  const invalidate = useInvalidateOrderWithCatalog(id);
  return useMutation({
    mutationFn: (input: AdminAddOrderItemInput) =>
      adminApi.addOrderItem(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminOrderItem(id: string) {
  const invalidate = useInvalidateOrderWithCatalog(id);
  return useMutation({
    mutationFn: (input: { itemId: string; body: AdminUpdateOrderItemInput }) =>
      adminApi.updateOrderItem(id, input.itemId, input.body),
    onSuccess: invalidate,
  });
}

export function useRemoveAdminOrderItem(id: string) {
  const invalidate = useInvalidateOrderWithCatalog(id);
  return useMutation({
    mutationFn: (itemId: string) => adminApi.removeOrderItem(id, itemId),
    onSuccess: invalidate,
  });
}

export function usePatchAdminOrderCustomer(id: string) {
  const invalidate = useInvalidateOrder(id);
  return useMutation({
    mutationFn: (input: AdminPatchOrderCustomerInput) =>
      adminApi.patchOrderCustomer(id, input),
    onSuccess: invalidate,
  });
}

/**
 * POS create. On success we don't have a pre-existing order key to refresh,
 * so we just sweep the lists + stats + catalog + customer-facing keys.
 * The hook returns the created `AdminOrderDetail` so the POS page can
 * redirect straight to the invoice.
 */
export function useCreatePosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreatePosOrderInput) =>
      adminApi.createPosOrder(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: adminKeys.ordersAll });
      qc.invalidateQueries({ queryKey: adminKeys.stats });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: adminKeys.productsAll });
      // Pre-seed the detail key so the invoice page renders immediately
      // without a second round-trip.
      qc.setQueryData(adminKeys.order(created._id), created);
    },
  });
}

/* ───────────────────── Products ───────────────────── */

export function useAdminProducts(params: AdminListProductsParams) {
  return useQuery({
    queryKey: adminKeys.products(params),
    queryFn: () => adminApi.listProducts(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminProduct(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminKeys.product(id) : ["admin", "product", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Product id is required");
      return adminApi.getProduct(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Product mutations invalidate:
 *  - the specific product's detail key (so the open edit page refetches)
 *  - every admin/products list query (so the moderation table reflects the
 *    new state - toggling active/featured changes which rows surface in
 *    each filter)
 *  - admin/stats (the products.active counter)
 *  - the storefront `products` keys (so listings/PDPs refresh, since the
 *    catalog cache is short-TTL but in-flight client queries are stale)
 *  - the storefront `product` keys for the same reason
 */
function useInvalidateProduct(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.product(id) });
    qc.invalidateQueries({ queryKey: adminKeys.productsAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
  };
}

/**
 * Create a product from the admin "New product" form. On success we don't
 * have a pre-existing detail key to refresh, so we pre-seed `adminKeys.product`
 * with the created record (the edit page can render immediately without a
 * second round-trip) and then invalidate the lists + stats + storefront keys
 * so the new row surfaces everywhere it should.
 */
export function useCreateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminProductCreate) => adminApi.createProduct(body),
    onSuccess: (created) => {
      qc.setQueryData(adminKeys.product(created._id), created);
      qc.invalidateQueries({ queryKey: adminKeys.productsAll });
      qc.invalidateQueries({ queryKey: adminKeys.stats });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
  });
}

export function useUpdateAdminProduct(id: string) {
  const invalidate = useInvalidateProduct(id);
  return useMutation({
    mutationFn: (patch: AdminProductPatch) => adminApi.updateProduct(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProduct(id),
    onSuccess: () => {
      // Wipe every product key - the just-deleted detail entry is now a 404
      // and the lists need to drop the row.
      qc.invalidateQueries({ queryKey: adminKeys.productsAll });
      qc.invalidateQueries({ queryKey: ["admin", "product"] });
      qc.invalidateQueries({ queryKey: adminKeys.stats });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
  });
}

export function useBulkApplySizeChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: import("@/types/admin").AdminBulkApplySizeChartBody) =>
      adminApi.bulkApplySizeChart(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.productsAll });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
  });
}

/* ───────────────────── Users ───────────────────── */

export function useAdminUsers(params: AdminListUsersParams) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminApi.listUsers(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminKeys.user(id) : ["admin", "user", "noop"],
    queryFn: () => {
      if (!id) throw new Error("User id is required");
      return adminApi.getUser(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * User mutations invalidate:
 *  - the specific user's detail key (open detail page refreshes)
 *  - every admin/users list query (table reflects the new role/status)
 *  - admin/stats (in case a future revision exposes user counts by role)
 *
 * Unlike product mutations there's no public-facing key to invalidate -
 * customer-side queries don't surface another user's role or suspension
 * state.
 */
function useInvalidateUser(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.user(id) });
    qc.invalidateQueries({ queryKey: adminKeys.usersAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
  };
}

export function useUpdateUserRole(id: string) {
  const invalidate = useInvalidateUser(id);
  return useMutation({
    mutationFn: (patch: AdminUserRolePatch) => adminApi.updateUserRole(id, patch),
    onSuccess: invalidate,
  });
}

export function useSetUserStatus(id: string) {
  const invalidate = useInvalidateUser(id);
  return useMutation({
    mutationFn: (patch: AdminUserStatusPatch) => adminApi.setUserStatus(id, patch),
    onSuccess: invalidate,
  });
}

/* ───────────────────── Categories ───────────────────── */

export function useAdminCategories(params: AdminListCategoriesParams) {
  return useQuery({
    queryKey: adminKeys.categories(params),
    queryFn: () => adminApi.listCategories(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminCategory(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminKeys.category(id) : ["admin", "category", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Category id is required");
      return adminApi.getCategory(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Category mutations invalidate:
 *  - every admin/categories list query (the tree-aware table needs to redraw)
 *  - the optional specific detail key (so an open edit page refetches)
 *  - admin/stats (no current dependency, but cheap and future-proof)
 *  - the storefront `categories` keys (so the global nav and category pages
 *    pick up the change - the public endpoint caches 600s server-side, so
 *    only client-side React Query state is in scope here)
 *  - the storefront `products` keys (a category rename or deactivation can
 *    change which products surface under it)
 */
function useInvalidateCategory(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: adminKeys.category(id) });
    qc.invalidateQueries({ queryKey: adminKeys.categoriesAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
}

export function useCreateAdminCategory() {
  const invalidate = useInvalidateCategory();
  return useMutation({
    mutationFn: (body: AdminCategoryCreate) => adminApi.createCategory(body),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminCategory(id: string) {
  const invalidate = useInvalidateCategory(id);
  return useMutation({
    mutationFn: (patch: AdminCategoryPatch) =>
      adminApi.updateCategory(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: () => {
      // Wipe every category key - the deleted detail entry is a 404 and the
      // table needs to drop the row. We also touch the storefront caches
      // since a removal cascades into nav and product browse pages.
      qc.invalidateQueries({ queryKey: adminKeys.categoriesAll });
      qc.invalidateQueries({ queryKey: ["admin", "category"] });
      qc.invalidateQueries({ queryKey: adminKeys.stats });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/* ───────────────────── Brands ───────────────────── */

export function useAdminBrands(params: AdminListBrandsParams) {
  return useQuery({
    queryKey: adminKeys.brands(params),
    queryFn: () => adminApi.listBrands(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminBrand(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminKeys.brand(id) : ["admin", "brand", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Brand id is required");
      return adminApi.getBrand(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Brand mutations fan out the same way as categories: admin list + optional
 * detail + stats + the storefront `brands` and `products` keys, since brand
 * rename/deactivation surfaces on the catalog filter rail and product cards.
 */
function useInvalidateBrand(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: adminKeys.brand(id) });
    qc.invalidateQueries({ queryKey: adminKeys.brandsAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["brands"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
}

export function useCreateAdminBrand() {
  const invalidate = useInvalidateBrand();
  return useMutation({
    mutationFn: (body: AdminBrandCreate) => adminApi.createBrand(body),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminBrand(id: string) {
  const invalidate = useInvalidateBrand(id);
  return useMutation({
    mutationFn: (patch: AdminBrandPatch) => adminApi.updateBrand(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteBrand(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.brandsAll });
      qc.invalidateQueries({ queryKey: ["admin", "brand"] });
      qc.invalidateQueries({ queryKey: adminKeys.stats });
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/* ───────────────────── Audit log ───────────────────── */

/**
 * Paginated feed of admin mutations. Read-only - the recorder runs
 * fire-and-forget off business mutations elsewhere, so there's no companion
 * useCreate / useDelete pair here. `placeholderData: keepPreviousData` keeps
 * the table populated while a filter change is in flight.
 */
export function useAdminAuditEvents(params: AdminListAuditEventsParams) {
  return useQuery({
    queryKey: adminKeys.audit(params),
    queryFn: () => adminApi.listAuditEvents(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/* ───────────────────── Q&A moderation ───────────────────── */

/**
 * Pending moderation queue is the default landing tab; the page can swap
 * `status` to "approved", "hidden", or "all". 15s staleTime mirrors the
 * review moderation surface - fast enough that a moderator who approves a
 * row sees it disappear from the pending list on the next refetch, slow
 * enough not to thrash the network.
 */
export function useAdminQuestions(params: AdminListQuestionsParams) {
  return useQuery({
    queryKey: adminKeys.questions(params),
    queryFn: () => adminApi.listQuestions(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/**
 * Q&A moderation invalidates:
 *  - every admin/questions list (the open queue redraws)
 *  - admin/stats (no current dependency, future-proof for a "pending Q&A" tile)
 *  - the storefront `questions` keys (the PDP picks up the new state without
 *    a manual refresh - important when a moderator approves while the asker
 *    is still on the product page)
 *  - the admin audit list (because the recorder writes a row on state-flip)
 */
function useInvalidateAfterQuestionModeration() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.questionsAll });
    qc.invalidateQueries({ queryKey: adminKeys.stats });
    qc.invalidateQueries({ queryKey: ["questions"] });
    qc.invalidateQueries({ queryKey: adminKeys.auditAll });
  };
}

export function useApproveQuestion() {
  const invalidate = useInvalidateAfterQuestionModeration();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveQuestion(id),
    onSuccess: invalidate,
  });
}

export function useHideQuestion() {
  const invalidate = useInvalidateAfterQuestionModeration();
  return useMutation({
    mutationFn: (id: string) => adminApi.hideQuestion(id),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminQuestion() {
  const invalidate = useInvalidateAfterQuestionModeration();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteQuestion(id),
    onSuccess: invalidate,
  });
}

export function useAdminSiteSettings() {
  return useQuery({
    queryKey: adminKeys.siteSettings,
    queryFn: () => adminApi.getSiteSettings(),
    staleTime: 30_000,
  });
}

export function useUpdateAdminSiteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: import("@/types/siteSettings").UpdateSiteSettingsBody) =>
      adminApi.updateSiteSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.siteSettings });
    },
  });
}

/* ───────────────────── Customization config ───────────────────── */

export function useAdminCustomizationConfig() {
  return useQuery({
    queryKey: adminKeys.customizations,
    queryFn: () => adminApi.getCustomizationConfig(),
    staleTime: 30_000,
  });
}

export function useUpdateAdminCustomizationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: import("@/types/customization").UpdateCustomizationConfigBody) =>
      adminApi.updateCustomizationConfig(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.customizations });
    },
  });
}

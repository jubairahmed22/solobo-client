import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  CustomizationConfig,
  UpdateCustomizationConfigBody,
} from "@/types/customization";
import type {
  AdminAddOrderItemInput,
  AdminBrandCreate,
  AdminBrandDetail,
  AdminBrandPatch,
  AdminBrandSummary,
  AdminCategoryCreate,
  AdminCategoryDetail,
  AdminCategoryPatch,
  AdminCategorySummary,
  AdminCreatePosOrderInput,
  AdminListAuditEventsParams,
  AdminListAuditEventsResponse,
  AdminListBrandsParams,
  AdminListCategoriesParams,
  AdminListOrdersParams,
  AdminListOrdersResponse,
  AdminListProductIdsResponse,
  AdminListProductsParams,
  AdminListProductsResponse,
  AdminListReviewsParams,
  AdminListReviewsResponse,
  AdminListUsersParams,
  AdminListUsersResponse,
  AdminOrderDetail,
  AdminPatchOrderCustomerInput,
  AdminBulkApplySizeChartBody,
  AdminProductCreate,
  AdminProductDetail,
  AdminProductPatch,
  AdminStats,
  AdminTimeseriesResponse,
  AdminUpdateOrderItemInput,
  AdminUserDetail,
  AdminUserRolePatch,
  AdminUserStatusPatch,
} from "@/types/admin";
import type { OrderStatus, PaymentStatus } from "@/types/commerce";
import type {
  AdminCreateCouponBody,
  AdminListCouponsParams,
  AdminListCouponsResponse,
  AdminUpdateCouponBody,
  Coupon,
} from "@/types/coupon";
import type {
  AdminCreateOfferBody,
  AdminListOffersParams,
  AdminListOffersResponse,
  AdminReplaceOfferBannersBody,
  AdminReplaceOfferProductsBody,
  AdminUpdateOfferBody,
  Offer,
} from "@/types/offer";
import type {
  AdminListQuestionsParams,
  AdminListQuestionsResponse,
} from "@/types/questions";
import type { SiteSettings, SiteSettingsWhatsApp, UpdateSiteSettingsBody } from "@/types/siteSettings";

export class AdminError extends Error {
  code: string;
  fieldErrors?: Array<{ path: string; message: string }>;
  constructor(
    message: string,
    code: string,
    fieldErrors?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new AdminError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof AdminError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new AdminError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  try {
    const res = await promise;
    if (res.data.success) return { data: res.data.data, meta: res.data.meta };
    throw new AdminError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof AdminError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new AdminError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

export const adminApi = {
  getStats: () => unwrap<AdminStats>(apiClient.get("/admin/stats")),
  /**
   * Platform-wide daily revenue/orders/units buckets for the admin dashboard
   * chart. `days` is clamped server-side to 7..90 and defaults to 30; we
   * send it explicitly so the React Query cache key stays stable. An
   * optional `sellerId` scopes the aggregate to a single seller's slice.
   */
  getTimeseries: (days: number, sellerId?: string) =>
    unwrap<AdminTimeseriesResponse>(
      apiClient.get("/admin/stats/timeseries", {
        params: sellerId ? { days, sellerId } : { days },
      }),
    ),

  listReviews: (params: AdminListReviewsParams = {}) =>
    unwrapWithMeta<AdminListReviewsResponse>(
      apiClient.get("/admin/reviews", { params }),
    ),

  approveReview: (id: string) =>
    unwrap<{ id: string; isApproved: boolean }>(
      apiClient.post(`/admin/reviews/${id}/approve`),
    ),

  hideReview: (id: string) =>
    unwrap<{ id: string; isApproved: boolean }>(
      apiClient.post(`/admin/reviews/${id}/hide`),
    ),

  deleteReview: (id: string) =>
    unwrap<{ id: string; deleted: boolean }>(
      apiClient.delete(`/admin/reviews/${id}`),
    ),

  /* ── Orders ──
   * Reads come off /admin/orders so we get the populated user shape and
   * filter knobs the table needs. Mutations reuse the existing /orders/:id
   * endpoints - those already accept admin callers and own the canonical
   * state-machine + stock restoration logic; duplicating them on /admin
   * would mean two places to keep in sync.
   */
  listOrders: (params: AdminListOrdersParams = {}) =>
    unwrapWithMeta<AdminListOrdersResponse>(
      apiClient.get("/admin/orders", { params }),
    ),

  getOrder: (id: string) =>
    unwrap<AdminOrderDetail>(apiClient.get(`/admin/orders/${id}`)),

  updateOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    unwrap<AdminOrderDetail>(
      apiClient.patch(`/orders/${id}/status`, { status, note }),
    ),

  cancelOrder: (id: string, reason?: string) =>
    unwrap<AdminOrderDetail>(
      apiClient.post(`/orders/${id}/cancel`, { reason }),
    ),

  updatePayment: (
    id: string,
    payload: {
      status: PaymentStatus;
      transactionId?: string;
      refundAmount?: number;
    },
  ) =>
    unwrap<AdminOrderDetail>(
      apiClient.patch(`/orders/${id}/payment`, payload),
    ),

  updateTracking: (
    id: string,
    patch: { carrier?: string; trackingNumber?: string; trackingUrl?: string },
  ) =>
    unwrap<AdminOrderDetail>(
      apiClient.patch(`/orders/${id}/tracking`, patch),
    ),

  /* ── Admin order line-item mutations + customer edit ──
   * These live on /admin/orders/* (NOT /orders/*) because the cashier-style
   * POS edits aren't allowed for the customer surface - they bypass the
   * usual state-machine guards (e.g. adding items to a "confirmed" order),
   * pull stock atomically, and re-run the coupon engine on the new
   * subtotal. The controller refuses to edit delivered/cancelled/returned
   * orders so the audit trail stays meaningful.
   */
  addOrderItem: (id: string, body: AdminAddOrderItemInput) =>
    unwrap<AdminOrderDetail>(
      apiClient.post(`/admin/orders/${id}/items`, body),
    ),

  updateOrderItem: (id: string, itemId: string, body: AdminUpdateOrderItemInput) =>
    unwrap<AdminOrderDetail>(
      apiClient.patch(`/admin/orders/${id}/items/${itemId}`, body),
    ),

  removeOrderItem: (id: string, itemId: string) =>
    unwrap<AdminOrderDetail>(
      apiClient.delete(`/admin/orders/${id}/items/${itemId}`),
    ),

  patchOrderCustomer: (id: string, body: AdminPatchOrderCustomerInput) =>
    unwrap<AdminOrderDetail>(
      apiClient.patch(`/admin/orders/${id}/customer`, body),
    ),

  /* Hard-delete an order. Irreversible - the backend restores stock for
   * still-live orders (cancelled/returned already had it returned) and logs
   * the delete to the audit trail. */
  deleteOrder: (id: string) =>
    unwrap<{ id: string; deleted: boolean }>(
      apiClient.delete(`/admin/orders/${id}`),
    ),

  /* ── POS create-order ──
   * POST /admin/orders. Server validates either `user` (existing account
   * lookup) or `customer` (walk-in block) - at least one must be present.
   * For cash sales the cashier sets `paymentStatus: "paid"` so the order
   * lands already closed; non-cash gateways follow the normal mark-paid
   * flow via the existing /orders/:id/payment endpoint afterwards.
   */
  createPosOrder: (body: AdminCreatePosOrderInput) =>
    unwrap<AdminOrderDetail>(apiClient.post("/admin/orders", body)),

  /* ── Products ──
   * Reads come off /admin/products (no isActive filter, cache-bypassed so
   * edits show up immediately). Mutations reuse PATCH/DELETE on
   * /products/:id - those already check owner-or-admin, and reusing them
   * keeps the seller-side experience consistent with the admin one.
   */
  listProducts: (params: AdminListProductsParams = {}) =>
    unwrapWithMeta<AdminListProductsResponse>(
      apiClient.get("/admin/products", { params }),
    ),

  /**
   * Returns just the ids matching the given filter set, without pagination.
   * Powers the offer form's "Select all matching" action so the user can
   * flip an entire result set into the chosen set without round-tripping
   * page-by-page. Caps at 10k server-side.
   */
  listProductIds: (params: AdminListProductsParams = {}) =>
    unwrap<AdminListProductIdsResponse>(
      apiClient.get("/admin/products", {
        params: { ...params, idsOnly: 1, page: undefined, limit: undefined },
      }),
    ),

  getProduct: (id: string) =>
    unwrap<AdminProductDetail>(apiClient.get(`/admin/products/${id}`)),

  /**
   * Create a product as an admin. There's no `/admin/products` create route -
   * the unified POST /products endpoint already accepts admin callers and
   * auto-stamps the owner from the JWT, so the admin form posts there
   * directly. Returns the populated `AdminProductDetail` shape because the
   * controller sends the same projection on create as on read.
   */
  createProduct: (body: AdminProductCreate) =>
    unwrap<AdminProductDetail>(apiClient.post("/products", body)),

  updateProduct: (id: string, patch: AdminProductPatch) =>
    unwrap<AdminProductDetail>(apiClient.patch(`/products/${id}`, patch)),

  deleteProduct: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/products/${id}`)),

  bulkApplySizeChart: (body: AdminBulkApplySizeChartBody) =>
    unwrap<{ updated: number; matched: number }>(
      apiClient.post("/admin/products/bulk/size-chart", body),
    ),

  /* ── Users ──
   * Reads come off /admin/users (includes suspended accounts, which the
   * auth flow rejects so they'd otherwise be invisible). Mutations target
   * role and status; we deliberately don't expose a generic PATCH /users/:id
   * - there are exactly two privileged things to do, and each gets its own
   * endpoint so audit logs stay clean.
   */
  listUsers: (params: AdminListUsersParams = {}) =>
    unwrapWithMeta<AdminListUsersResponse>(
      apiClient.get("/admin/users", { params }),
    ),

  getUser: (id: string) =>
    unwrap<AdminUserDetail>(apiClient.get(`/admin/users/${id}`)),

  updateUserRole: (id: string, patch: AdminUserRolePatch) =>
    unwrap<{ _id: string; role: AdminUserDetail["role"] }>(
      apiClient.patch(`/admin/users/${id}/role`, patch),
    ),

  setUserStatus: (id: string, patch: AdminUserStatusPatch) =>
    unwrap<{
      _id: string;
      isSuspended: boolean;
      suspendedAt?: string;
      suspendedReason?: string;
    }>(apiClient.patch(`/admin/users/${id}/status`, patch)),

  /* ── Categories ──
   * Admin-side reads hit the public /categories endpoint with shape=flat
   * (the public endpoint serves both, switching on a query param). The
   * cache there has a 600s TTL, so an admin write won't show up on the
   * storefront immediately - we lean on client-side React Query
   * invalidation for the dashboard tables and accept the storefront lag.
   */
  listCategories: (params: AdminListCategoriesParams = {}) =>
    unwrapWithMeta<AdminCategorySummary[]>(
      apiClient.get("/categories", {
        params: { shape: "flat", limit: 100, ...params },
      }),
    ),

  getCategory: (id: string) =>
    unwrap<AdminCategoryDetail>(apiClient.get(`/categories/${id}`)),

  createCategory: (body: AdminCategoryCreate) =>
    unwrap<AdminCategoryDetail>(apiClient.post("/categories", body)),

  updateCategory: (id: string, patch: AdminCategoryPatch) =>
    unwrap<AdminCategoryDetail>(apiClient.patch(`/categories/${id}`, patch)),

  deleteCategory: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/categories/${id}`)),

  /* ── Brands ── (same pattern as categories) */
  listBrands: (params: AdminListBrandsParams = {}) =>
    unwrapWithMeta<AdminBrandSummary[]>(
      apiClient.get("/brands", { params: { limit: 100, ...params } }),
    ),

  getBrand: (id: string) =>
    unwrap<AdminBrandDetail>(apiClient.get(`/brands/${id}`)),

  createBrand: (body: AdminBrandCreate) =>
    unwrap<AdminBrandDetail>(apiClient.post("/brands", body)),

  updateBrand: (id: string, patch: AdminBrandPatch) =>
    unwrap<AdminBrandDetail>(apiClient.patch(`/brands/${id}`, patch)),

  deleteBrand: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/brands/${id}`)),

  /* ── Coupons ──
   * Admin can issue both platform and seller-scope codes. The seller surface
   * (/api/seller/coupons) only covers the latter - admins keep the override
   * path so support can hotfix a misbehaving seller code without waiting on
   * the seller. `code`, `scope`, and `owner` are frozen post-creation; that's
   * enforced server-side too and is why the update body type omits them.
   */
  listCoupons: (params: AdminListCouponsParams = {}) =>
    unwrapWithMeta<AdminListCouponsResponse>(
      apiClient.get("/admin/coupons", { params }),
    ),

  getCoupon: (id: string) =>
    unwrap<Coupon>(apiClient.get(`/admin/coupons/${id}`)),

  createCoupon: (body: AdminCreateCouponBody) =>
    unwrap<Coupon>(apiClient.post("/admin/coupons", body)),

  updateCoupon: (id: string, patch: AdminUpdateCouponBody) =>
    unwrap<Coupon>(apiClient.patch(`/admin/coupons/${id}`, patch)),

  deleteCoupon: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/admin/coupons/${id}`)),

  /* ── Offers ──
   * Admin-curated auto-apply promotions, distinct from coupons:
   *  - Buyers don't type a code; the pricing engine resolves the best active
   *    offer for each product at cart/checkout time.
   *  - Products are an explicit allow-list, materialised once at save time so
   *    the engine doesn't re-run the admin's category/brand/search filters
   *    on every read.
   *  - The carousel banner manager and product selector each get a dedicated
   *    PUT endpoint so the dashboard can replace the entire set in one shot
   *    (drag-drop reorder + cross-page "select all" both produce the full
   *    list as their natural output, not a diff).
   *
   * Unlike coupons we don't freeze any fields post-creation; the admin can
   * rename, reslug, change discount math, or extend the validity window at
   * any time and the engine picks up the change on the next cart calc.
   */
  listOffers: (params: AdminListOffersParams = {}) =>
    unwrapWithMeta<AdminListOffersResponse>(
      apiClient.get("/admin/offers", { params }),
    ),

  getOffer: (id: string) =>
    unwrap<Offer>(apiClient.get(`/admin/offers/${id}`)),

  createOffer: (body: AdminCreateOfferBody) =>
    unwrap<Offer>(apiClient.post("/admin/offers", body)),

  updateOffer: (id: string, patch: AdminUpdateOfferBody) =>
    unwrap<Offer>(apiClient.patch(`/admin/offers/${id}`, patch)),

  /**
   * Replace the offer's product allow-list. PUT semantics - the body carries
   * the full resolved id list, not a diff. Called by the product selector
   * panel once the admin commits a "select all 47 filtered" action.
   */
  replaceOfferProducts: (id: string, body: AdminReplaceOfferProductsBody) =>
    unwrap<Offer>(apiClient.put(`/admin/offers/${id}/products`, body)),

  /**
   * Replace the offer's banner carousel. PUT semantics - the body carries
   * the full ordered list. The backend renumbers `order` to match the array
   * index so the storefront doesn't have to re-sort.
   */
  replaceOfferBanners: (id: string, body: AdminReplaceOfferBannersBody) =>
    unwrap<Offer>(apiClient.put(`/admin/offers/${id}/banners`, body)),

  deleteOffer: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/admin/offers/${id}`)),

  /* ── Audit log ──
   * Read-only feed of admin mutations. The recorder is wired into existing
   * controllers (order status / cancel / payment, review moderation, user
   * role + status, coupon CRUD) and writes fire-and-forget, so this endpoint
   * is the only client-facing surface. Server clamps `limit` to 50.
   */
  listAuditEvents: (params: AdminListAuditEventsParams = {}) =>
    unwrapWithMeta<AdminListAuditEventsResponse>(
      apiClient.get("/admin/audit", { params }),
    ),

  /* ── Q&A moderation ──
   * Mirrors review moderation: list / approve / hide / delete. The recorder
   * fires from the controller on state-flip - re-approving an already-
   * approved row is a no-op for the audit trail, so the UI can re-issue
   * approves idempotently without polluting the log.
   */
  listQuestions: (params: AdminListQuestionsParams = {}) =>
    unwrapWithMeta<AdminListQuestionsResponse>(
      apiClient.get("/admin/questions", { params }),
    ),

  approveQuestion: (id: string) =>
    unwrap<{ id: string; isApproved: boolean }>(
      apiClient.post(`/admin/questions/${id}/approve`),
    ),

  hideQuestion: (id: string) =>
    unwrap<{ id: string; isHidden: boolean }>(
      apiClient.post(`/admin/questions/${id}/hide`),
    ),

  deleteQuestion: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/admin/questions/${id}`)),

  /* ── Site settings ──
   * Singleton company profile + delivery charges + policy pages (terms,
   * returns, shipping) + FAQs. The public storefront read at
   * /api/site-settings returns the same shape; only the write surface is
   * admin-gated. PUT is partial - nested objects (`delivery`, `contact`)
   * are merged sub-document-deep on the server, so the form can submit
   * just the field(s) that changed without re-sending the rest.
   */
  getSiteSettings: () =>
    unwrap<SiteSettings>(apiClient.get("/admin/site-settings")),

  updateSiteSettings: (body: UpdateSiteSettingsBody) =>
    unwrap<SiteSettings>(apiClient.put("/admin/site-settings", body)),

  testWhatsApp: (phone: string, config: SiteSettingsWhatsApp) =>
    unwrap<{ sent: boolean }>(
      apiClient.post("/admin/site-settings/whatsapp-test", { phone, config }),
    ),

  /* ── Customization config ──
   * Singleton patch library + enabled category slugs + add-on prices.
   * Admin write surface; public read at /api/customizations. */
  getCustomizationConfig: () =>
    unwrap<CustomizationConfig>(apiClient.get("/admin/customizations")),

  updateCustomizationConfig: (body: UpdateCustomizationConfigBody) =>
    unwrap<CustomizationConfig>(apiClient.put("/admin/customizations", body)),
};

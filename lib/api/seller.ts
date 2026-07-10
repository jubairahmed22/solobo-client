import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  SellerListOrdersParams,
  SellerListOrdersResponse,
  SellerListProductsParams,
  SellerListProductsResponse,
  SellerOrderDetail,
  SellerProductCreate,
  SellerProductDetail,
  SellerProductPatch,
  SellerProfile,
  SellerProfilePatch,
  SellerStats,
  SellerTimeseriesResponse,
} from "@/types/seller";
import type { OrderStatus, PaymentStatus, Order } from "@/types/commerce";
import type {
  Coupon,
  SellerCreateCouponBody,
  SellerListCouponsParams,
  SellerListCouponsResponse,
  SellerUpdateCouponBody,
} from "@/types/coupon";

/**
 * Seller-side API client. Mirrors the admin client wrapper pattern: reads
 * hit /api/seller/* (which scopes to the authed seller), and product
 * mutations reuse the existing /api/products endpoints - those already
 * enforce owner-or-admin so we don't end up with two places that need to
 * agree.
 */

export class SellerError extends Error {
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
    throw new SellerError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof SellerError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new SellerError(
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
    throw new SellerError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof SellerError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new SellerError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

export const sellerApi = {
  getStats: () => unwrap<SellerStats>(apiClient.get("/seller/stats")),
  /**
   * Daily revenue/orders/units buckets for the dashboard chart. `days`
   * is clamped server-side to 7..90 and defaults to 30; we still send
   * the param explicitly so the React Query cache key stays stable
   * across renders that re-derive a default elsewhere.
   */
  getTimeseries: (days: number) =>
    unwrap<SellerTimeseriesResponse>(
      apiClient.get("/seller/stats/timeseries", { params: { days } }),
    ),

  /* ── Storefront profile ──
   * Drives the seller's public /store/:slug page. `getProfile` returns the
   * full storefront slice (name, avatar, slug, bio). `updateProfile` accepts
   * partial patches - undefined fields keep their previous value, while an
   * empty string for storeBio explicitly clears it.
   *
   * The backend returns 409 with `code: "SLUG_TAKEN"` and a field error on
   * `storeSlug` when the chosen slug is in use. The settings form binds that
   * to the field via react-hook-form's setError so it lands inline.
   */
  getProfile: () => unwrap<SellerProfile>(apiClient.get("/seller/profile")),

  updateProfile: (patch: SellerProfilePatch) =>
    unwrap<SellerProfile>(apiClient.patch("/seller/profile", patch)),

  /* ── Products ──
   * Reads come off /seller/products (auto-scoped to req.user.id, includes
   * inactive items). Mutations target /products - those already enforce
   * owner-or-admin and own the search-index invalidation logic.
   */
  listProducts: (params: SellerListProductsParams = {}) =>
    unwrapWithMeta<SellerListProductsResponse>(
      apiClient.get("/seller/products", { params }),
    ),

  getProduct: (id: string) =>
    unwrap<SellerProductDetail>(apiClient.get(`/seller/products/${id}`)),

  createProduct: (body: SellerProductCreate) =>
    unwrap<SellerProductDetail>(apiClient.post("/products", body)),

  updateProduct: (id: string, patch: SellerProductPatch) =>
    unwrap<SellerProductDetail>(apiClient.patch(`/products/${id}`, patch)),

  deleteProduct: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/products/${id}`)),

  /* ── Orders ──
   * Reads come off /seller/orders. Each row projects only the items
   * belonging to this seller plus the per-seller subtotal so multi-seller
   * orders don't leak siblings' fulfilment to this one. Mutations
   * (status + tracking) reuse the existing /orders/:id endpoints - those
   * already accept seller callers (any user with at least one line item in
   * the order can drive the state machine) and own the transition logic.
   */
  listOrders: (params: SellerListOrdersParams = {}) =>
    unwrapWithMeta<SellerListOrdersResponse>(
      apiClient.get("/seller/orders", { params }),
    ),

  getOrder: (id: string) =>
    unwrap<SellerOrderDetail>(apiClient.get(`/seller/orders/${id}`)),

  /**
   * Drive the order state machine - backend enforces legal transitions
   * (pending → confirmed → packed → shipped → delivered, plus cancel /
   * return). The /orders/:id/status endpoint also flips payment to paid
   * on delivery for COD orders, which is why we don't manage that here.
   *
   * Returns the full Order document. The seller detail view re-fetches
   * through `/seller/orders/:id` on success anyway (to re-apply the
   * per-seller projection), so callers don't need to consume this shape.
   */
  updateOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}/status`, { status, note })),

  /**
   * Save carrier / tracking number / URL. The backend accepts partial
   * updates - fields left undefined keep their previous value. Pass an
   * empty string explicitly if v2 needs to support clearing.
   */
  updateOrderTracking: (
    id: string,
    patch: { carrier?: string; trackingNumber?: string; trackingUrl?: string },
  ) => unwrap<Order>(apiClient.patch(`/orders/${id}/tracking`, patch)),

  /* ── Coupons ──
   * Seller surface is hard-scoped to the authed seller - scope/owner are
   * stamped server-side and the list filter is locked to owner === self.
   * `applicableProducts` (when set) is validated against the seller's own
   * catalog at the controller; the API returns a 400 with field-level errors
   * pointing at the offending product ids, which the form can surface inline.
   */
  listCoupons: (params: SellerListCouponsParams = {}) =>
    unwrapWithMeta<SellerListCouponsResponse>(
      apiClient.get("/seller/coupons", { params }),
    ),

  getCoupon: (id: string) =>
    unwrap<Coupon>(apiClient.get(`/seller/coupons/${id}`)),

  createCoupon: (body: SellerCreateCouponBody) =>
    unwrap<Coupon>(apiClient.post("/seller/coupons", body)),

  updateCoupon: (id: string, patch: SellerUpdateCouponBody) =>
    unwrap<Coupon>(apiClient.patch(`/seller/coupons/${id}`, patch)),

  deleteCoupon: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/seller/coupons/${id}`)),
};

// Re-export so consumers don't have to import from two places when
// extending the seller surface - the order mutations rely on these enums.
export type { OrderStatus, PaymentStatus };

/**
 * Coupon types - shared between admin, seller, and cart surfaces.
 *
 * The backend Coupon doc has both admin and seller workflows reading it; the
 * field set is identical, only the *shape* of allowed inputs differs (admins
 * pick scope, sellers don't). We model that by sharing one `Coupon` read type
 * and having distinct create/update payloads for each surface.
 *
 * Wire shape comes off /api/(admin|seller)/coupons. `owner` is populated on
 * the admin list/detail responses with `{ _id, name, email, storeSlug }`.
 */

export type CouponType = "percent" | "flat";
export type CouponScope = "platform" | "seller";

/**
 * Coupon rejection codes returned by the cart's applyCoupon endpoint when a
 * code is invalid. Surfaced on the cart envelope as `couponError.code` so the
 * UI can pick a friendlier per-rule message if desired (we default to using
 * the backend's human message).
 */
export type CouponRejectionCode =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "EXHAUSTED"
  | "PER_USER_LIMIT"
  | "MIN_NOT_MET"
  | "NOT_APPLICABLE"
  | "CODE_TAKEN"
  | "VALIDATION_ERROR";

/** Populated owner shape on admin list/detail responses. */
export interface CouponOwnerRef {
  _id: string;
  name?: string;
  email?: string;
  storeSlug?: string;
}

/** Populated product / category refs on the detail response. */
export interface CouponProductRef {
  _id: string;
  title: string;
  slug: string;
}
export interface CouponCategoryRef {
  _id: string;
  name: string;
  slug: string;
}

/**
 * Full coupon read shape. `owner` is `null` for platform-scope coupons. On
 * list responses we get the populated owner ref; on the detail response the
 * applicable* arrays are also populated. We type both as `unknown[]` and
 * narrow in the consumer because the backend population varies by endpoint.
 */
export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  minOrderTotal: number;
  maxRedemptions?: number;
  redemptions: number;
  perUserLimit: number;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  scope: CouponScope;
  /** Populated `{ _id, name, email, storeSlug }` on the admin surface; plain
   *  id (or null) on the seller surface where the owner is always you. */
  owner: CouponOwnerRef | string | null;
  applicableProducts: Array<CouponProductRef | string>;
  applicableCategories: Array<CouponCategoryRef | string>;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────── Admin payloads ───────────────────── */

export interface AdminListCouponsParams {
  q?: string;
  scope?: CouponScope;
  active?: "true" | "false";
  owner?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "code-asc" | "code-desc" | "redemptions-desc";
}

export interface AdminListCouponsResponse {
  coupons: Coupon[];
}

export interface AdminCreateCouponBody {
  code: string;
  description?: string;
  scope: CouponScope;
  /** Required when scope === "seller", forbidden when scope === "platform". */
  owner?: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  minOrderTotal?: number;
  maxRedemptions?: number;
  perUserLimit?: number;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
  applicableProducts?: string[];
  applicableCategories?: string[];
  currency?: string;
}

/**
 * Admin update - `code`, `scope`, and `owner` are frozen post-issuance, so
 * the patch shape omits them entirely. Everything else is partial.
 */
export type AdminUpdateCouponBody = Partial<
  Omit<AdminCreateCouponBody, "code" | "scope" | "owner">
>;

/* ───────────────────── Seller payloads ───────────────────── */

export interface SellerListCouponsParams {
  q?: string;
  active?: "true" | "false";
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "code-asc" | "code-desc" | "redemptions-desc";
}

export interface SellerListCouponsResponse {
  coupons: Coupon[];
}

/**
 * Seller create - no `scope` or `owner` (stamped server-side), no
 * `applicableCategories` (seller scope only allow-lists at the product
 * level), and `value` is clamped 1–100 by Zod for percent coupons.
 */
export interface SellerCreateCouponBody {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  minOrderTotal?: number;
  maxRedemptions?: number;
  perUserLimit?: number;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
  applicableProducts?: string[];
  currency?: string;
}

export type SellerUpdateCouponBody = Partial<
  Omit<SellerCreateCouponBody, "code">
>;

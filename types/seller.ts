/**
 * Shapes returned by /api/seller/*. Mirrors the backend's `seller.controller.ts`
 * envelopes so the seller dashboard, products surface, and orders queue can be
 * statically typed.
 *
 * Many shapes deliberately overlap their admin counterparts (we share the
 * underlying table components where it makes sense). Where the seller view
 * narrows or projects differently - e.g. `sellerSubtotal` on orders - those
 * fields are introduced here.
 */

import type {
  Address,
  OrderPayment,
  OrderStatus,
  OrderTimelineEvent,
  OrderTracking,
  PaymentStatus,
  ReturnRequest,
} from "./commerce";
import type {
  AdminProductPatch,
  AdminProductSort,
  AdminProductStatus,
} from "./admin";

/* ───── Dashboard stats ───── */

export interface SellerCounts {
  total: number;
}

export interface SellerProductCounts {
  total: number;
  active: number;
}

export interface SellerOrderCounts {
  total: number;
  recent: number;
  pendingFulfilment: number;
}

export interface SellerRevenue {
  /** Lifetime revenue for this seller's line items across delivered orders. */
  total: number;
  /** Same but in the last 30 days. */
  recent: number;
  currency: string;
}

export interface SellerRecentOrder {
  _id: string;
  orderNumber: string;
  total: number;
  /** Subtotal for this seller's slice of the order. */
  sellerSubtotal: number;
  currency: string;
  status: string;
  itemCount: number;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface SellerTopProduct {
  productId: string;
  title: string;
  units: number;
  revenue: number;
}

export interface SellerStats {
  products: SellerProductCounts;
  orders: SellerOrderCounts;
  revenue: SellerRevenue;
  recentOrders: SellerRecentOrder[];
  topProducts: SellerTopProduct[];
}

/* ───── Daily sales time-series (Phase 27) ───── */

/**
 * A single daily bucket. `date` is YYYY-MM-DD in the server's timezone
 * (effectively BDT for the MVP). Zero-filled days are included for
 * continuous axis rendering - the frontend never has to gap-fill.
 */
export interface SellerTimeseriesPoint {
  date: string;
  revenue: number;
  orderCount: number;
  unitCount: number;
}

export interface SellerTimeseriesResponse {
  window: { days: number; from?: string; to?: string };
  currency: string;
  series: SellerTimeseriesPoint[];
  totals: { revenue: number; orderCount: number; unitCount: number };
}

/* ───── Products (seller-owned) ───── */

/**
 * The seller list shape mirrors {@link AdminProductSummary} minus the
 * `seller` ref (always self). We re-declare instead of re-exporting so the
 * seller types file stands on its own.
 */
export interface SellerProductRef {
  id: string;
  name: string;
  slug?: string;
}

export interface SellerProductSummary {
  _id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  ratingAverage: number;
  ratingCount: number;
  image?: string;
  category: SellerProductRef | null;
  brand: SellerProductRef | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full detail returned by `GET /api/seller/products/:id`. We don't redeclare
 * every field - the backend returns the full Product document plus populated
 * refs - but pin the bits the editor touches so it stays statically safe.
 */
/**
 * Variant row as returned by the backend. Mirrors the Product.variants
 * subdoc - `_id` is a Mongo id (already stringified server-side), `options`
 * is a free-form key/value map that drives storefront filters and labels
 * (e.g. `{Color: "Red", Size: "M"}`).
 */
export interface SellerProductVariant {
  _id: string;
  sku: string;
  options?: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
  isActive: boolean;
}

/**
 * Input shape for variant rows on create/patch. `_id` is omitted because
 * the backend stamps it; we send the rest as a flat array and the server
 * reconciles add/remove/update via the embedded subdoc array.
 */
export interface SellerProductVariantInput {
  sku: string;
  options?: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
  isActive?: boolean;
}

export interface SellerProductDetail extends SellerProductSummary {
  description?: string;
  shortDescription?: string;
  images?: Array<{ url: string; alt?: string; publicId?: string }>;
  tags?: string[];
  variants?: SellerProductVariant[];
  trackStock?: boolean;
  lowStockThreshold?: number;
  /** Always the requester's own id. */
  seller: { id: string; name: string };
}

export type SellerProductStatus = AdminProductStatus;
export type SellerProductSort = AdminProductSort;

export interface SellerListProductsParams {
  status?: SellerProductStatus;
  q?: string;
  sort?: SellerProductSort;
  page?: number;
  limit?: number;
}

export interface SellerListProductsResponse {
  products: SellerProductSummary[];
}

/**
 * Seller edit patch. Same safe subset as the admin one, plus images,
 * variants, category, and brand - all four are managed inline in the
 * seller's product form. Category/brand are ObjectId strings.
 */
export type SellerProductPatch = AdminProductPatch & {
  images?: Array<{ url: string; alt?: string; publicId?: string }>;
  variants?: SellerProductVariantInput[];
  category?: string;
  brand?: string | null;
};

/**
 * What the create endpoint accepts. The owner is auto-stamped from the
 * access token; the rest mirrors {@link AdminProductPatch} with `title`,
 * `price`, and `stock` required.
 */
export interface SellerProductCreate {
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  isActive?: boolean;
  isFeatured?: boolean;
  trackStock?: boolean;
  /** Low-stock alert threshold. Defaults to 5 server-side when omitted. */
  lowStockThreshold?: number;
  /** ObjectId of the primary category - required by the backend's
   *  createProductSchema. The seller form blocks submit when empty. */
  category: string;
  brand?: string;
  tags?: string[];
  images?: Array<{ url: string; alt?: string; publicId?: string }>;
  variants?: SellerProductVariantInput[];
}

/* ───── Orders touching this seller ───── */

export interface SellerOrderLineItem {
  _id: string;
  product: string | null;
  title: string;
  slug: string;
  image?: string;
  qty: number;
  price: number;
  lineTotal: number;
}

export interface SellerOrderSummary {
  _id: string;
  orderNumber: string;
  email?: string;
  /** Order total across all sellers. */
  total: number;
  /** Just this seller's slice. */
  sellerSubtotal: number;
  currency: string;
  status: OrderStatus;
  payment: { status: PaymentStatus; method: string };
  itemCount: number;
  /** Line items belonging to this seller only - siblings are scrubbed. */
  sellerItems: SellerOrderLineItem[];
  shippingDistrict?: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; phone?: string } | null;
}

export type SellerOrderSort = "newest" | "oldest" | "total-desc" | "total-asc";

export interface SellerListOrdersParams {
  status?: OrderStatus | "";
  paymentStatus?: PaymentStatus | "";
  q?: string;
  sort?: SellerOrderSort;
  page?: number;
  limit?: number;
}

export interface SellerListOrdersResponse {
  orders: SellerOrderSummary[];
}

/**
 * Full line item as returned by `/api/seller/orders/:id`. The list-view
 * `SellerOrderLineItem` is a slim subset of this - the detail page needs
 * SKU, options (e.g. Color: Red, Size: M), and the original-price snapshot.
 */
export interface SellerOrderDetailItem {
  _id: string;
  product: string | null;
  variantId?: string;
  title: string;
  slug: string;
  image?: string;
  sku?: string;
  options?: Record<string, string>;
  qty: number;
  price: number;
  originalPrice?: number;
  lineTotal: number;
}

/**
 * Full order envelope projected through the seller's view. `sellerItems`
 * holds only this seller's lines (siblings are scrubbed). Money fields
 * (`subtotal`, `total`) reflect the whole order - `sellerSubtotal` is the
 * slice that belongs to this seller. Timeline + tracking + customer info
 * are surfaced in full so the seller can drive fulfilment.
 */
export interface SellerOrderDetail {
  _id: string;
  orderNumber: string;
  email?: string;
  /** Order-wide totals. */
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  /** Just this seller's slice. */
  sellerSubtotal: number;
  currency: string;
  status: OrderStatus;
  payment: OrderPayment;
  tracking?: OrderTracking;
  timeline: OrderTimelineEvent[];
  itemCount: number;
  sellerItems: SellerOrderDetailItem[];
  shippingAddress: Address;
  customerNote?: string;
  cancelledAt?: string;
  cancelReason?: string;
  /**
   * Active return / RMA on this order, if any. The seller-side detail
   * renders the approve/reject panel off this - `sellerItems` is already
   * scoped to the caller's own lines, so the picker is rendered against
   * the intersection of those and `returnRequest.items`.
   */
  returnRequest?: ReturnRequest;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; phone?: string } | null;
}

/* ───── Storefront profile ───── */

/**
 * The slice of the seller's user record that drives /store/[slug]. Returned
 * by GET /api/seller/profile and accepted by PATCH /api/seller/profile.
 *
 * `storeSlug` may still be null on accounts that haven't published yet - the
 * settings page lets sellers set it themselves rather than waiting for the
 * auto-mint that fires on first product creation.
 */
export interface SellerProfile {
  id: string;
  name: string;
  avatar: string | null;
  storeSlug: string | null;
  storeBio: string | null;
  /** Convenience: the public path when `storeSlug` is set, else null. */
  storeUrl: string | null;
}

export interface SellerProfilePatch {
  name?: string;
  storeSlug?: string;
  /** Empty string is meaningful - clears the bio. */
  storeBio?: string;
}

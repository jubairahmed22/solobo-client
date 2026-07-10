/**
 * Shapes returned by /api/admin/*. Mirrors the backend's `admin.controller.ts`
 * envelope so the dashboard and moderation queue can be statically typed.
 */

import type {
  AddressInput,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "./commerce";
import type { ProductDetail } from "./catalog";

export interface AdminCounts {
  total: number;
  recent: number;
}

export interface AdminOrderCounts extends AdminCounts {
  pendingFulfilment: number;
}

export interface AdminProductCounts {
  total: number;
  active: number;
}

export interface AdminRevenue {
  total: number;
  recent: number;
  currency: string;
}

export interface AdminReviewCounts {
  total: number;
  pending: number;
}

export interface AdminRecentOrder {
  _id: string;
  orderNumber: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface AdminTopProduct {
  productId: string;
  title: string;
  units: number;
  revenue: number;
}

export interface AdminStats {
  users: AdminCounts;
  products: AdminProductCounts;
  orders: AdminOrderCounts;
  revenue: AdminRevenue;
  reviews: AdminReviewCounts;
  recentOrders: AdminRecentOrder[];
  topProducts: AdminTopProduct[];
  orderStatuses: Record<string, number>;
}

/* ───── Daily sales time-series (Phase 28) ───── */

/**
 * Platform-wide daily bucket. Same shape as `SellerTimeseriesPoint` - the
 * shared `SalesChartSvg` accepts either via structural typing - but kept
 * separate so the admin surface can evolve independently (e.g. add a
 * per-seller breakdown column later).
 */
export interface AdminTimeseriesPoint {
  date: string;
  revenue: number;
  orderCount: number;
  unitCount: number;
}

export interface AdminTimeseriesResponse {
  window: { days: number; from?: string; to?: string };
  currency: string;
  /** Echo of the `sellerId` query param when scoped, otherwise null. */
  sellerId: string | null;
  series: AdminTimeseriesPoint[];
  totals: { revenue: number; orderCount: number; unitCount: number };
}

/* ───── Review moderation ───── */

export interface AdminReview {
  _id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
  isApproved: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  isVerifiedPurchase: boolean;
  user: { id: string; name: string; email: string; avatar?: string } | null;
  product: { id: string; title: string; slug: string } | null;
}

export type AdminReviewStatus = "all" | "approved" | "pending";

export interface AdminListReviewsParams {
  status?: AdminReviewStatus;
  productId?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
}

export interface AdminListReviewsResponse {
  reviews: AdminReview[];
}

/* ───── Order management ───── */

/**
 * Slim shape returned by `GET /api/admin/orders`. We project just enough for
 * the moderation table - the full order document is fetched lazily on the
 * detail page via {@link AdminOrderDetail}.
 */
export interface AdminOrderSummary {
  _id: string;
  orderNumber: string;
  email?: string;
  total: number;
  currency: string;
  status: OrderStatus;
  payment: {
    status: PaymentStatus;
    method: string;
  };
  itemCount: number;
  shippingDistrict?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
}

/**
 * Full detail returned by `GET /api/admin/orders/:id`. Same fields as the
 * customer-facing {@link Order} but with a populated user shape replacing
 * the raw user ObjectId.
 */
export type AdminOrderDetail = Omit<Order, "user"> & {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
};

export type AdminOrderSort = "newest" | "oldest" | "total-desc" | "total-asc";

export interface AdminListOrdersParams {
  status?: OrderStatus | "";
  paymentStatus?: PaymentStatus | "";
  q?: string;
  from?: string;
  to?: string;
  sort?: AdminOrderSort;
  page?: number;
  limit?: number;
}

export interface AdminListOrdersResponse {
  orders: AdminOrderSummary[];
}

/* ───── Catalog management ───── */

export interface AdminProductRef {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Slim shape returned by `GET /api/admin/products`. Includes inactive items
 * (the public listing filters them out) and adds the bits the moderation
 * table needs - current stock, active/featured flags, seller name.
 */
export interface AdminProductSummary {
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
  category: AdminProductRef | null;
  brand: AdminProductRef | null;
  seller: AdminProductRef | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full detail returned by `GET /api/admin/products/:id`. Same fields as the
 * customer-facing {@link ProductDetail} but with populated category/brand/
 * seller refs - the storefront sometimes leaves these as raw IDs.
 */
export type AdminProductDetail = Omit<
  ProductDetail,
  "category" | "brand" | "seller"
> & {
  category: AdminProductRef | null;
  brand: AdminProductRef | null;
  seller: AdminProductRef | null;
};

export type AdminProductStatus = "all" | "active" | "inactive" | "out-of-stock";

export type AdminProductSort =
  | "newest"
  | "oldest"
  | "price-desc"
  | "price-asc"
  | "stock-asc"
  | "stock-desc";

export interface AdminListProductsParams {
  status?: AdminProductStatus;
  q?: string;
  sort?: AdminProductSort;
  page?: number;
  limit?: number;
  /** ObjectId or slug. Filters to products under this category. */
  category?: string;
  /** ObjectId or slug. Filters to products under this brand. */
  brand?: string;
}

export interface AdminListProductsResponse {
  products: AdminProductSummary[];
}

/**
 * The selector's "Select all matching" action calls the same list endpoint
 * with `idsOnly=1`, which short-circuits the projection so it returns just
 * the ids of every product matching the current filter set (no pagination,
 * capped at 10k). The body schema is intentionally minimal.
 */
export interface AdminListProductIdsResponse {
  ids: string[];
}

/**
 * Subset of fields the admin edit form mutates. The backend's
 * `updateProductSchema` accepts every {@link ProductDetail} field; we pick
 * the safe ones here so the UI doesn't accidentally clobber
 * variants/images/seller during a quick edit.
 *
 * The new-product form sends a superset (images, variants, category, brand)
 * - those flow through {@link AdminProductCreate}.
 */
export interface AdminSizeChartInput {
  unit?: "cm" | "inches";
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
  notes?: string;
}

export interface AdminProductPatch {
  title?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  trackStock?: boolean;
  lowStockThreshold?: number;
  tags?: string[];
  /** Optional product-level code / base SKU. */
  sku?: string;
  /** ObjectId of the primary category. */
  category?: string;
  /** ObjectIds of secondary categories for cross-listing. */
  categories?: string[];
  /** ObjectId of the brand. */
  brand?: string;
  /** SEO meta title - <title> / og:title. Max 160 chars server-side. */
  metaTitle?: string;
  /** SEO meta description - <meta name="description">. Max 320 chars. */
  metaDescription?: string;
  /** Lifecycle state - drives the storefront's 301/410 SEO strategy. */
  lifecycleStatus?: "active" | "discontinued";
  /** ObjectId of the replacement product (301 target) when discontinued. */
  replacedBy?: string;
  /** Free-form spec attributes (Color, Size, Weight, …) as a flat key/value map. */
  attributes?: Record<string, string>;
  /** Structured size chart for apparel, footwear, etc. */
  sizeChart?: AdminSizeChartInput | null;
  /** Product image gallery - replaces the entire array on save. */
  images?: Array<{ url: string; alt?: string; publicId?: string }>;
  /** Variant array - replaces entire subdoc array on save. */
  variants?: AdminProductVariantInput[];
}

/**
 * Variant row shape on product create. The backend stamps `_id` on each row
 * once it saves; we send the rest as a flat array. Mirrors the backend's
 * `variantInput` Zod schema and the seller-side `SellerProductVariantInput`
 * (kept duplicated so the admin module stays self-contained - the two
 * shapes are intentionally identical because both surfaces hit the same
 * `/api/products` endpoint).
 */
export interface AdminProductVariantInput {
  sku: string;
  options?: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
  isActive?: boolean;
}

/**
 * Body accepted by `POST /api/products` from the admin "New product" form.
 * The owner is auto-stamped from the access token (the admin user becomes
 * the seller of products created here). Mirrors backend `createProductSchema`:
 * title/category/price are required, everything else is optional.
 */
export interface AdminProductCreate {
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  stock?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  trackStock?: boolean;
  /** Low-stock alert threshold. Defaults to 5 server-side when omitted. */
  lowStockThreshold?: number;
  /** ObjectId of the primary category - required by `createProductSchema`. */
  category: string;
  /** ObjectIds of secondary categories for cross-listing. */
  categories?: string[];
  brand?: string;
  tags?: string[];
  /** Optional product-level code / base SKU. */
  sku?: string;
  images?: Array<{ url: string; alt?: string; publicId?: string }>;
  variants?: AdminProductVariantInput[];
  /** SEO meta title - <title> / og:title. Max 160 chars server-side. */
  metaTitle?: string;
  /** SEO meta description - <meta name="description">. Max 320 chars. */
  metaDescription?: string;
  /** Lifecycle state - drives the storefront's 301/410 SEO strategy. */
  lifecycleStatus?: "active" | "discontinued";
  /** ObjectId of the replacement product (301 target) when discontinued. */
  replacedBy?: string;
  /** Free-form spec attributes (Color, Size, Weight, …) as a flat key/value map. */
  attributes?: Record<string, string>;
  /** Structured size chart for apparel, footwear, etc. */
  sizeChart?: AdminSizeChartInput;
}

/* ───── User management ───── */

/**
 * Roles the admin UI surfaces. Mirrors backend `Role` exactly, but lifted
 * here so the moderation surface doesn't have to import auth types.
 */
export type AdminUserRole = "user" | "admin" | "superadmin";

/**
 * What the role-change endpoint accepts. We never expose `superadmin` as a
 * mutation target - that role is bootstrapped via the DB.
 */
export type AdminAssignableRole = "user" | "admin";

/**
 * Slim shape returned by `GET /api/admin/users`. Includes the suspension
 * flag so the table can render a status badge without a second round-trip.
 * Notably _absent_: password hashes, OTP state, refresh-token rows - the
 * backend select() explicitly drops those.
 */
export interface AdminUserSummary {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: AdminUserRole;
  emailVerified: boolean;
  isSuspended: boolean;
  suspendedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRecentOrder {
  _id: string;
  orderNumber: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  createdAt: string;
}

/**
 * Full detail returned by `GET /api/admin/users/:id`. Adds lifetime
 * commerce stats and a 5-deep recent-order strip so the page can render
 * the customer's history without a second fetch.
 */
export interface AdminUserDetail extends AdminUserSummary {
  providers: string[];
  coins: number;
  addressCount: number;
  suspendedReason?: string;
  stats: {
    orderCount: number;
    lifetimeSpend: number;
  };
  recentOrders: AdminUserRecentOrder[];
}

export type AdminUserStatus = "all" | "active" | "suspended";
export type AdminUserRoleFilter = "all" | AdminUserRole;
export type AdminUserSort = "newest" | "oldest";

export interface AdminListUsersParams {
  role?: AdminUserRole;
  status?: Exclude<AdminUserStatus, "all">;
  q?: string;
  sort?: AdminUserSort;
  page?: number;
  limit?: number;
}

export interface AdminListUsersResponse {
  users: AdminUserSummary[];
}

export interface AdminUserRolePatch {
  role: AdminAssignableRole;
}

export interface AdminUserStatusPatch {
  isSuspended: boolean;
  reason?: string;
}

/* ───── Catalog taxonomy (categories + brands) ───── */

/**
 * Admin-shape category. Mirrors the Category mongoose doc - `path` is the
 * derived slash-joined route ("clothing/men/shirts") that the storefront
 * uses. `ancestors` is the materialised path from root, handy for the
 * tree-aware list view to know how deeply to indent each row.
 */
export interface AdminCategorySummary {
  _id: string;
  name: string;
  slug: string;
  path: string;
  description?: string;
  image?: string;
  icon?: string;
  parent: string | null;
  ancestors: string[];
  order: number;
  isActive: boolean;
  metaTitle?: string;
  metaDescription?: string;
  /** Default size chart applied to products in this category. */
  sizeChart?: AdminSizeChartInput | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminCategoryDetail = AdminCategorySummary;

export interface AdminListCategoriesParams {
  /** "flat" is what the admin table wants; tree is reserved for the storefront nav. */
  shape?: "flat" | "tree";
  parent?: string | null;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminCategoryCreate {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  icon?: string;
  parent?: string | null;
  order?: number;
  isActive?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  /** Default size chart inherited by products in this category. */
  sizeChart?: AdminSizeChartInput | null;
}

export type AdminCategoryPatch = Partial<AdminCategoryCreate>;

export interface AdminBulkApplySizeChartBody {
  ids: string[];
  sizeChart: AdminSizeChartInput | null;
}

export interface AdminBrandSummary {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  order: number;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdminBrandDetail = AdminBrandSummary;

export interface AdminListBrandsParams {
  search?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminBrandCreate {
  name: string;
  slug?: string;
  description?: string;
  logo?: string;
  banner?: string;
  website?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  order?: number;
  metaTitle?: string;
  metaDescription?: string;
}

export type AdminBrandPatch = Partial<AdminBrandCreate>;

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Admin audit trail. Polymorphic via `{ targetKind, targetId, targetLabel }`
 * so we can route a row to the right detail page without N+1 joins; the
 * label is denormalised at write time so deleted targets still render.
 */

export type AuditTargetKind =
  | "Order"
  | "Product"
  | "User"
  | "Review"
  | "Coupon"
  | "Category"
  | "Brand"
  | "Question";

export interface AuditEventActor {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin";
}

export interface AuditEvent {
  _id: string;
  action: string;
  actor: AuditEventActor;
  targetKind: AuditTargetKind;
  targetId: string;
  targetLabel: string;
  diff: Record<string, unknown>;
  note?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AdminListAuditEventsParams {
  action?: string;
  targetKind?: AuditTargetKind;
  targetId?: string;
  actor?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminListAuditEventsResponse {
  events: AuditEvent[];
}

/* -------------------------------------------------------------------------- */
/* Admin order mutations + POS                                                */
/* -------------------------------------------------------------------------- */

/**
 * Body for adding a line item to an existing order (the cashier picks a
 * product from the live search inside the order edit surface). Mirrors
 * `adminAddOrderItemSchema` on the backend exactly - both flows route
 * through the same `resolveLineItem`-style lookup, so any axis (Size /
 * Color / Storage / Material) can be expressed via `options` and the
 * server picks the right variant.
 */
export interface AdminAddOrderItemInput {
  productId: string;
  variantId?: string;
  qty: number;
  options?: Record<string, string>;
}

/**
 * Body for changing the quantity on an existing order line. Removing a
 * line uses the DELETE endpoint instead - there's no `qty: 0` short-cut
 * because the controller refuses to leave an order empty and we want the
 * intent to be explicit at the API surface.
 */
export interface AdminUpdateOrderItemInput {
  qty: number;
}

/**
 * Patch shape for the "fix the customer details" surface - narrow on
 * purpose. Status, payment, tracking, items each have dedicated endpoints,
 * so this is the only PATCH the cashier ever uses for free-form text
 * fields and the shipping address. `shippingAddress` is partial so
 * the UI can ship a single-field nudge ("phone was wrong") without
 * resending the whole block.
 */
export interface AdminPatchOrderCustomerInput {
  email?: string;
  customerNote?: string;
  internalNotes?: string;
  shippingAddress?: Partial<AddressInput>;
}

/**
 * One line in the POS create-order payload. Same shape as
 * {@link AdminAddOrderItemInput}; we keep it as a separate alias because
 * the POS surface tends to grow ad-hoc fields (giftMessage, lineNote)
 * that don't belong on the add-line endpoint.
 */
export interface AdminPosOrderItemInput {
  productId: string;
  variantId?: string;
  qty: number;
  options?: Record<string, string>;
}

/**
 * Walk-in customer block - used when the cashier is creating a POS order
 * for someone without an account. Either this OR `user` (existing user id)
 * must be present; the controller enforces the contract.
 */
export interface AdminPosWalkInCustomer {
  name: string;
  email?: string;
  phone: string;
}

/**
 * Body for `POST /api/admin/orders` - the POS "create an order on behalf
 * of a customer" surface. `user` is set when the cashier looked up an
 * existing account; `customer` is set for walk-ins. At least one of the
 * two is required.
 *
 * `paymentStatus` defaults to `"pending"` server-side so non-cash gateways
 * follow their normal mark-paid flow. For cash sales the cashier flips
 * this to `"paid"` and the resulting order lands fully closed.
 */
export interface AdminCreatePosOrderInput {
  user?: string;
  customer?: AdminPosWalkInCustomer;
  shippingAddress: AddressInput;
  items: AdminPosOrderItemInput[];
  paymentMethod: PaymentMethod;
  paymentStatus?: "pending" | "paid";
  transactionId?: string;
  couponCode?: string;
  customerNote?: string;
  internalNotes?: string;
}

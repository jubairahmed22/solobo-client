/**
 * Cart, Address, and Order types - mirror the backend Mongoose models so the
 * frontend can render server payloads without further mapping.
 */

/* ───────────── Address ───────────── */

export interface Address {
  _id?: string;
  label?: string;
  fullName: string;
  phone: string;
  altPhone?: string;
  line1: string;
  line2?: string;
  city: string;
  district: string;
  division?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export type AddressInput = Omit<Address, "_id">;

/* ───────────── Cart ───────────── */

export interface ServerCartItem {
  _id: string;
  product: string;
  variantId?: string;
  slug: string;
  title: string;
  image?: string;
  sku?: string;
  options?: Record<string, string>;
  price: number;
  originalPrice?: number;
  currency: string;
  qty: number;
  stock?: number;
  seller?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerCart {
  _id: string;
  user: string;
  items: ServerCartItem[];
  couponCode?: string;
  subtotal: number;
  itemCount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddCartItemInput {
  productId: string;
  variantId?: string;
  qty: number;
  options?: Record<string, string>;
}

/**
 * Coupon engine rejection codes - mirrors the backend's `CouponRejection`
 * union. `couponError.code` on the envelope is set to one of these when a
 * stored cart code stops being valid (expired, exhausted, items removed,
 * etc.) so the UI can surface a clear-and-prompt without re-running the
 * apply flow.
 */
export type CartCouponRejectionCode =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "EXHAUSTED"
  | "PER_USER_LIMIT"
  | "MIN_NOT_MET"
  | "NOT_APPLICABLE";

/**
 * Applied-coupon snapshot the backend computes on every cart read. We get
 * the resolved discount (already rounded and capped) plus the eligible
 * subtotal - which for seller-scope coupons may be less than `cart.subtotal`
 * because only the seller's slice participates.
 */
export interface AppliedCoupon {
  code: string;
  type: "percent" | "flat";
  value: number;
  scope: "platform" | "seller";
  discount: number;
  eligibleSubtotal: number;
}

/**
 * Wire shape returned by every /api/cart/* endpoint. The cart slice itself
 * is the raw Cart doc; `appliedCoupon` is non-null when the stored
 * `cart.couponCode` still validates, and `couponError` carries the rejection
 * code/message when it doesn't (so the UI can prompt the user to remove or
 * pick a new code).
 */
export interface CartEnvelope {
  cart: ServerCart;
  appliedCoupon: AppliedCoupon | null;
  couponError: { code: CartCouponRejectionCode; message: string } | null;
  /**
   * Populated by /cart/merge - productIds the server couldn't resolve
   * against an active product (deleted, out of stock, variants required
   * but none chosen, etc.). The frontend prunes those entries from the
   * local cart and surfaces a clear message instead of dropping the user
   * on an empty checkout.
   */
  skipped?: Array<{ productId: string; code: string; message: string }>;
  /** Number of items the merge successfully added/updated. */
  mergedCount?: number;
}

export interface MergeCartItem {
  productId: string;
  variantId?: string;
  qty: number;
  options?: Record<string, string>;
}

/* ───────────── Order ───────────── */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod =
  | "cod"
  | "bkash"
  | "nagad"
  | "rocket"
  | "sslcommerz"
  | "stripe"
  | "paypal"
  | "card"
  | "bank_transfer";

export interface OrderItem {
  _id: string;
  product: string;
  variantId?: string;
  slug: string;
  title: string;
  image?: string;
  sku?: string;
  options?: Record<string, string>;
  price: number;
  originalPrice?: number;
  qty: number;
  lineTotal: number;
  seller?: string;
}

export interface OrderPayment {
  status: PaymentStatus;
  method: PaymentMethod;
  transactionId?: string;
  paidAt?: string;
  refundedAt?: string;
  refundAmount?: number;
}

export interface OrderTracking {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  note?: string;
  by?: string;
  at: string;
}

/* ───────────── Returns / RMA ───────────── */

/**
 * Lifecycle of a return request. We intentionally keep it short and
 * shippable: a buyer-raised `requested` row terminates in either
 * `approved` (stock restored, payment refunded, order flipped to
 * `returned`) or `rejected` (no side-effects beyond the audit row).
 * The buyer is allowed to resubmit after a rejection.
 */
export type ReturnStatus = "requested" | "approved" | "rejected";

/**
 * One requested line on a return. `itemId` points at an `OrderItem._id`
 * and `qty` must be <= the original line qty. Partial returns are
 * supported (return 2 of 3 ordered) - the server validates this on
 * both sides and the picker UI enforces it client-side.
 */
export interface ReturnLine {
  itemId: string;
  qty: number;
}

/**
 * Active return request on an order. Absent when no return has been
 * raised. The buyer renders status + (when set) a decision note; the
 * seller renders the per-line picker and the approve/reject panel
 * gated on status === "requested".
 */
export interface ReturnRequest {
  status: ReturnStatus;
  reason?: string;
  items: ReturnLine[];
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export interface RequestReturnInput {
  reason: string;
  items: ReturnLine[];
}

export interface DecideReturnInput {
  action: "approve" | "reject";
  note?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  user: string;
  email?: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  couponCode?: string;
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
  payment: OrderPayment;
  tracking?: OrderTracking;
  customerNote?: string;
  internalNotes?: string;
  cancelledAt?: string;
  cancelReason?: string;
  /** Active return, if any. See {@link ReturnRequest}. */
  returnRequest?: ReturnRequest;
  createdAt: string;
  updatedAt: string;
}

export type OrderSort = "newest" | "oldest" | "total-desc" | "total-asc";

export interface OrderListQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  user?: string;
  seller?: string;
  from?: string;
  to?: string;
  q?: string;
  sort?: OrderSort;
  page?: number;
  limit?: number;
}

/** A single acquisition snapshot (utm + ad-platform click ids). */
export interface AttributionTouch {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  msclkid?: string;
  referrer?: string;
  landingPage?: string;
}

/** Attribution payload sent at checkout; persisted on the order + user. */
export interface CheckoutAttribution {
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
  gaClientId?: string;
  fbp?: string;
  fbc?: string;
}

export interface CheckoutInput {
  shippingAddressId?: string;
  shippingAddress?: AddressInput;
  billingAddressId?: string;
  billingAddress?: AddressInput;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  customerNote?: string;
  saveAddress?: boolean;
  /** Marketing attribution snapshot; persisted on the order + user server-side. */
  attribution?: CheckoutAttribution;
}

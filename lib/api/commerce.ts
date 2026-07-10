import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  Address,
  AddressInput,
  CartEnvelope,
  AddCartItemInput,
  DecideReturnInput,
  MergeCartItem,
  Order,
  OrderListQuery,
  CheckoutInput,
  GuestCheckoutInput,
  OrderStatus,
  PaymentStatus,
  RequestReturnInput,
} from "@/types/commerce";

/* ───────────── helpers ───────────── */

export class CommerceError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (res.data.success) return res.data.data;
  throw new CommerceError(res.data.message, res.data.code ?? "ERROR");
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await promise;
  if (res.data.success) return { data: res.data.data, meta: res.data.meta };
  throw new CommerceError(res.data.message, res.data.code ?? "ERROR");
}

/* ───────────── Cart ───────────── */

/**
 * Cart endpoints - every method returns the full `CartEnvelope` so consumers
 * always have access to the derived coupon state (`appliedCoupon`,
 * `couponError`) without a second roundtrip. Hooks below stash the envelope
 * under the `commerce.cart` query key.
 *
 * `applyCoupon` throws on rejection (422 from the backend) - the cart hook
 * surfaces that to the form for inline error display. After a successful
 * apply, the envelope's `appliedCoupon` field will be populated.
 */
export const cartApi = {
  get: () => unwrap<CartEnvelope>(apiClient.get("/cart")),
  addItem: (input: AddCartItemInput) =>
    unwrap<CartEnvelope>(apiClient.post("/cart/items", input)),
  updateItem: (itemId: string, qty: number) =>
    unwrap<CartEnvelope>(apiClient.patch(`/cart/items/${itemId}`, { qty })),
  removeItem: (itemId: string) =>
    unwrap<CartEnvelope>(apiClient.delete(`/cart/items/${itemId}`)),
  clear: () => unwrap<CartEnvelope>(apiClient.delete("/cart")),
  applyCoupon: (code: string) =>
    unwrap<CartEnvelope>(apiClient.post("/cart/coupon", { code })),
  removeCoupon: () => unwrap<CartEnvelope>(apiClient.delete("/cart/coupon")),
  merge: (items: MergeCartItem[]) =>
    unwrap<CartEnvelope>(apiClient.post("/cart/merge", { items })),
};

/* ───────────── Address book ───────────── */

export const addressApi = {
  list: () => unwrap<Address[]>(apiClient.get("/addresses")),
  create: (input: AddressInput) => unwrap<Address>(apiClient.post("/addresses", input)),
  update: (id: string, patch: Partial<AddressInput>) =>
    unwrap<Address>(apiClient.patch(`/addresses/${id}`, patch)),
  remove: (id: string) =>
    unwrap<{ id: string }>(apiClient.delete(`/addresses/${id}`)),
  setDefault: (id: string) =>
    unwrap<Address>(apiClient.post(`/addresses/${id}/default`)),
};

/* ───────────── Orders ───────────── */

export const orderApi = {
  checkout: (input: CheckoutInput) =>
    unwrap<Order>(apiClient.post("/orders/checkout", input)),

  /** Guest checkout - public endpoint, no auth token required. */
  guestCheckout: (input: GuestCheckoutInput) =>
    unwrap<Order>(apiClient.post("/orders/guest-checkout", input)),

  list: (params?: OrderListQuery) =>
    unwrapWithMeta<Order[]>(apiClient.get("/orders", { params })),

  get: (id: string) => unwrap<Order>(apiClient.get(`/orders/${id}`)),

  cancel: (id: string, reason?: string) =>
    unwrap<Order>(apiClient.post(`/orders/${id}/cancel`, { reason })),

  updateStatus: (id: string, status: OrderStatus, note?: string) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}/status`, { status, note })),

  updatePayment: (id: string, status: PaymentStatus, transactionId?: string, refundAmount?: number) =>
    unwrap<Order>(
      apiClient.patch(`/orders/${id}/payment`, { status, transactionId, refundAmount }),
    ),

  updateTracking: (
    id: string,
    patch: { carrier?: string; trackingNumber?: string; trackingUrl?: string },
  ) => unwrap<Order>(apiClient.patch(`/orders/${id}/tracking`, patch)),

  /**
   * Buyer-initiated return. The backend enforces eligibility (status
   * must be `delivered`, within the 14-day window) and rejects unknown
   * item ids or qtys that exceed the original purchase. A 409 surfaces
   * as a `CommerceError` with code `RETURN_EXISTS` when a request is
   * already in flight or approved.
   */
  requestReturn: (id: string, input: RequestReturnInput) =>
    unwrap<Order>(apiClient.post(`/orders/${id}/return-request`, input)),

  /**
   * Seller / admin approves or rejects an open return. Approving is
   * terminal: stock is restored for tracked products, payment is flipped
   * to `refunded`, and order status moves to `returned`. Rejection only
   * stamps a decision row - the buyer may then resubmit.
   */
  decideReturn: (id: string, input: DecideReturnInput) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}/return-request/decide`, input)),
};

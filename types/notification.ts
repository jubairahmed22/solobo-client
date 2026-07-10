/**
 * In-app notification types.
 *
 * Wire shape returned from /api/notifications. Distinct from emails: emails
 * fire and are gone, notifications persist and have a read/unread state the
 * UI uses to drive the sidebar badge and recent-events drawer.
 *
 * `payload` is a discriminated bag keyed off `type` so each consumer can
 * pull the fields it expects without a giant union elsewhere.
 */

export type NotificationType =
  | "order_placed"
  | "order_status"
  | "review_new"
  | "return_update"
  | "stock_low"
  | "system";

export interface OrderPlacedPayload {
  orderNumber: string;
  itemCount: number;
  subtotal: number;
  currency: string;
}

export interface OrderStatusPayload {
  orderNumber: string;
  oldStatus?: string;
  newStatus: string;
}

export interface ReviewNewPayload {
  productTitle: string;
  rating: number;
}

export interface SystemPayload {
  title?: string;
  message?: string;
}

/**
 * Return / RMA lifecycle notification payload.
 *
 * Sent to sellers when a buyer first requests a return (`returnStatus:
 * "requested"`, carries the buyer's `reason`), and to the buyer when a
 * seller/admin decides (`returnStatus: "approved" | "rejected"`, carries
 * the decider's optional `note`).
 *
 * Recipient routing is handled at the call site; the payload itself is
 * the same shape for both audiences so the renderer only has to branch on
 * `returnStatus`.
 */
export interface ReturnUpdatePayload {
  orderNumber: string;
  returnStatus: "requested" | "approved" | "rejected";
  reason?: string;
  note?: string;
}

/**
 * Stock-low alert payload. Fired to a seller when a checkout decrement
 * causes a product (or specific variant) to cross from above their
 * `lowStockThreshold` down to at-or-below. The bell deep-links to the
 * product edit page so the seller can restock or adjust pricing in one
 * click. `variantLabel` is omitted for products without variants.
 */
export interface StockLowPayload {
  productId: string;
  productTitle: string;
  variantLabel?: string;
  remaining: number;
  threshold: number;
}

export type NotificationPayload =
  | OrderPlacedPayload
  | OrderStatusPayload
  | ReviewNewPayload
  | ReturnUpdatePayload
  | StockLowPayload
  | SystemPayload
  | Record<string, unknown>;

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  /** Order id when type is order_*. Undefined for system / review_new. */
  order?: string;
  payload: NotificationPayload;
  read: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread?: boolean;
}

export interface NotificationListResponse {
  notifications: Notification[];
}

export interface UnreadCountResponse {
  count: number;
}

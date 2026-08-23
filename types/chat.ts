/**
 * AI shopping-assistant chat types - shared between the storefront widget
 * and the admin "Chat Logs" review page.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface OrderPlaced {
  orderNumber: string;
  total: number;
  currency: string;
  url: string;
}

export interface CheckoutFormVariant {
  id: string;
  options: Record<string, string>;
  price: number;
  stock: number;
}

export interface CheckoutForm {
  productId: string;
  slug: string;
  title: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  stock: number;
  trackStock: boolean;
  variants: CheckoutFormVariant[];
}

export interface SendChatMessageResponse {
  reply: string;
  orderPlaced?: OrderPlaced;
  checkoutForm?: CheckoutForm;
}

export interface ChatCheckoutAddress {
  line1: string;
  city?: string;
  district: string;
  division?: string;
  postalCode?: string;
}

export interface ChatCheckoutBody {
  sessionId: string;
  productId: string;
  variantId?: string;
  qty: number;
  fullName: string;
  phone: string;
  address: ChatCheckoutAddress;
}

/* ───────────────────── Admin ───────────────────── */

export interface AdminChatSessionSummary {
  _id: string;
  sessionId: string;
  user?: string;
  orderIds: string[];
  status: "open" | "closed";
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface AdminChatSessionDetail {
  _id: string;
  sessionId: string;
  user?: string;
  status: "open" | "closed";
  lastMessageAt: string;
  createdAt: string;
  messages: ChatMessage[];
  orderIds: Array<{ _id: string; orderNumber: string; total: number; status: string }>;
}

export interface AdminListChatSessionsParams {
  q?: string;
  page?: number;
  limit?: number;
}

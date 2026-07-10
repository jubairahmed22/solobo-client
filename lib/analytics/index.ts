/**
 * Public analytics façade. Import from "@/lib/analytics" everywhere in the app
 * - never reach into ./client directly. The typed helpers below are the only
 * sanctioned way to record funnel events, so the event names + prop shapes
 * stay consistent with the backend reports that aggregate them.
 */

export {
  analytics,
  initAnalytics,
  track,
  setAnalyticsConsent,
  getAnalyticsConsent,
} from "./client";
export type { AnalyticsEventName, TrackPayload, ConsentState } from "./client";
export type { Attribution, CheckoutAttribution } from "./attribution";
export {
  getCheckoutAttribution,
  getGaClientId,
  getFbCookies,
  resolveAttribution,
} from "./attribution";

import { track } from "./client";

export function trackPageView(path?: string, title?: string): void {
  track("page_view", { path, title });
}

export function trackProductView(p: {
  productId: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  category?: string;
  brand?: string;
}): void {
  track("product_view", {
    value: p.price,
    currency: p.currency,
    props: {
      productId: p.productId,
      slug: p.slug,
      title: p.title,
      category: p.category,
      brand: p.brand,
    },
  });
}

export function trackProductListView(p: {
  listName: string;
  count: number;
  query?: string;
}): void {
  track("product_list_view", { props: p });
}

export function trackSearch(query: string, results?: number): void {
  track("search", { props: { query, results } });
}

export function trackAddToCart(p: {
  productId: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  qty: number;
  variantId?: string;
}): void {
  track("add_to_cart", {
    value: p.price * p.qty,
    currency: p.currency,
    props: {
      productId: p.productId,
      slug: p.slug,
      title: p.title,
      qty: p.qty,
      variantId: p.variantId,
    },
  });
}

export function trackBeginCheckout(p: { value: number; currency: string; items: number }): void {
  track("begin_checkout", {
    value: p.value,
    currency: p.currency,
    props: { items: p.items },
  });
}

export function trackPurchase(p: {
  orderId: string;
  orderNumber?: string;
  value: number;
  currency: string;
  items: number;
  coupon?: string;
}): void {
  track("purchase", {
    value: p.value,
    currency: p.currency,
    props: {
      orderId: p.orderId,
      orderNumber: p.orderNumber,
      items: p.items,
      coupon: p.coupon,
    },
  });
}

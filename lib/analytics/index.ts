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

/**
 * Meta Pixel bridge for the catalog-relevant funnel events (ViewContent /
 * AddToCart / Purchase). Separate from the first-party `track()` above -
 * that one ships to our own /analytics/collect + GTM's dataLayer, neither of
 * which reaches Meta. This calls the pixel loaded by TrackingPixels.tsx
 * directly (`window.fbq`), a no-op when the pixel isn't configured.
 *
 * `content_ids` MUST match the `id` column in the product feed
 * (Server's /api/feeds/meta-products.csv) - a mismatch silently breaks
 * catalog-matched retargeting/dynamic ads even though the pixel still
 * "fires" successfully. The feed and the order-paid Conversions API event
 * (Server/src/services/analytics/conversions.service.ts) both key on the
 * product's own _id, so this does too.
 */
function metaPixel(event: string, params: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;
  // eventID (third arg) is how Meta dedupes this browser Pixel call against
  // the matching server-side Conversions API event - see trackPurchase,
  // which shares the exact `order_<id>` id the backend already uses.
  if (eventId) fbq("track", event, params, { eventID: eventId });
  else fbq("track", event, params);
}

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
  metaPixel("ViewContent", {
    content_ids: [p.productId],
    content_type: "product",
    content_name: p.title,
    value: p.price,
    currency: p.currency,
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
  metaPixel("AddToCart", {
    content_ids: [p.productId],
    content_type: "product",
    content_name: p.title,
    value: p.price * p.qty,
    currency: p.currency,
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
  /** Product ids in this order - powers catalog-matched Purchase attribution. */
  productIds?: string[];
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
  // Same event id format the backend's server-side Conversions API Purchase
  // uses (see Server's conversions.service.ts onOrderPaid) - sharing it lets
  // Meta dedupe this browser-side fire against that server-side one instead
  // of double-counting the sale.
  metaPixel(
    "Purchase",
    {
      content_ids: p.productIds ?? [],
      content_type: "product",
      value: p.value,
      currency: p.currency,
      num_items: p.items,
    },
    `order_${p.orderId}`,
  );
}

/**
 * Product lifecycle → SEO response policy.
 *
 * Single source of truth for how a product's lifecycle state maps onto an HTTP
 * response, kept as a configuration table rather than scattered `if` branches
 * so the strategy is data you can read at a glance (and extend - e.g. adding a
 * "coming_soon" state later is one row, not a new code path).
 *
 * Enforced by the edge middleware (see middleware.ts) because Next.js Server
 * Components cannot emit raw 301/410 status codes.
 *
 *   active        → 200 (pass through; out-of-stock is still 200 + OutOfStock
 *                   schema, handled by the product page's JSON-LD)
 *   discontinued  → 301 to the replacement product when one is set,
 *                   otherwise 410 Gone
 */

export type LifecycleStatus = "active" | "discontinued";

/** Shape returned by `GET /api/products/:slug/lifecycle`. */
export interface LifecycleInfo {
  status: LifecycleStatus;
  /** Slug of the replacement product, when the seller set one. */
  replacedBySlug?: string;
}

export type LifecycleAction =
  | { kind: "pass" }
  | { kind: "redirect"; to: string; status: 301 }
  | { kind: "gone"; status: 410 };

/**
 * The policy table. Each lifecycle status maps to a resolver that, given the
 * full lifecycle info, returns the action to take. Adding a new state is a
 * single new entry here.
 */
export const LIFECYCLE_POLICY: Record<
  LifecycleStatus,
  (info: LifecycleInfo) => LifecycleAction
> = {
  active: () => ({ kind: "pass" }),
  discontinued: (info) =>
    info.replacedBySlug
      ? { kind: "redirect", to: `/product/${info.replacedBySlug}`, status: 301 }
      : { kind: "gone", status: 410 },
};

/**
 * Resolve the SEO action for a product. Unknown/garbage statuses fail open to
 * `pass` so a bad value never blocks a page.
 */
export function resolveLifecycleAction(info: LifecycleInfo): LifecycleAction {
  const resolver = LIFECYCLE_POLICY[info.status];
  return resolver ? resolver(info) : { kind: "pass" };
}

/** Minimal, indexable "no longer available" body for the 410 response. */
export function goneHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>No longer available</title><style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#fff;color:#0a0a0a}main{max-width:28rem;text-align:center;padding:1.5rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#525252;margin:0 0 1.25rem}a{color:#0a0a0a;font-weight:600}</style></head><body><main><h1>This product is no longer available</h1><p>It has been discontinued and is no longer sold.</p><a href="/">Continue shopping →</a></main></body></html>`;
}

/**
 * Canonical URL normalization - the defence against duplicate indexing.
 *
 * Listing pages can be reached through countless permutations of the same
 * content: filters (`?brand=`, `?category=`, `?price=`), sorting (`?sort=`),
 * pagination (`?page=`), search (`?q=`), and tracking (`?utm_*`, `?gclid`).
 * Each is a distinct URL but (near-)identical content, which dilutes ranking
 * and wastes crawl budget. `normalizeCanonical` collapses them to a single
 * canonical URL.
 *
 * Default policy: STRIP every query param (canonical = clean path), so all
 * facet/sort/page/query variants point at one canonical. Pass `keep` to
 * preserve specific params (e.g. keep `["q"]` if you ever make search results
 * indexable, or `["page"]` for self-referencing paginated canonicals).
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Params that always create duplicate/faceted variants (never canonical). */
export const FACETED_PARAMS = [
  "sort",
  "page",
  "brand",
  "category",
  "price",
  "tags",
  "rating",
  "q",
  "view",
] as const;

/** Tracking params - always stripped from canonicals. */
export const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
  "ref",
] as const;

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined> | string | undefined;

function toSearchParams(input: SearchInput): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return input;
  if (typeof input === "string") return new URLSearchParams(input);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((val) => sp.append(k, val));
    else sp.set(k, v);
  }
  return sp;
}

/** Strip a leading-slashed path of its trailing slash (except root). */
function cleanPath(pathname: string): string {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (p === "/") return "/";
  return p.replace(/\/+$/, "");
}

export interface NormalizeOptions {
  /** Query params to PRESERVE on the canonical (everything else is dropped). */
  keep?: string[];
}

/**
 * Produce the absolute canonical URL for a path + its incoming query string.
 * Kept params are emitted in a stable (sorted) order so the canonical is
 * deterministic regardless of the source param order.
 */
export function normalizeCanonical(
  pathname: string,
  search?: SearchInput,
  opts: NormalizeOptions = {},
): string {
  const base = `${SITE_URL}${cleanPath(pathname)}`;
  const keep = opts.keep ?? [];
  if (keep.length === 0) return base;

  const sp = toSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of [...keep].sort()) {
    const values = sp.getAll(key);
    for (const v of values) if (v) kept.append(key, v);
  }
  const qs = kept.toString();
  return qs ? `${base}?${qs}` : base;
}

/** True when the request carries any faceted/tracking param (i.e. non-canonical). */
export function isNonCanonicalRequest(search?: SearchInput): boolean {
  const sp = toSearchParams(search);
  const dup = [...FACETED_PARAMS, ...TRACKING_PARAMS];
  return dup.some((k) => sp.has(k));
}

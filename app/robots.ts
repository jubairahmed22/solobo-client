import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Dynamic robots.txt.
 *
 * Strategy:
 *  - BLOCK private/utility surfaces (cart, checkout, account, API, admin) for
 *    everyone - they're never useful in search and waste crawl budget.
 *  - BLOCK faceted/sorted/paginated/tracking URLs (the `?sort=`, `?page=`,
 *    `?brand=`, `?utm_*` … variants) so crawlers don't index the duplicate
 *    permutations of listing pages. Their clean canonical is handled in
 *    lib/seo/canonical.ts; this stops the crawl from wasting time on them.
 *  - ALLOW all search-engine crawlers on everything else (the `*` rule's
 *    base `allow: "/"`), and explicitly welcome the major AI crawlers for GEO.
 *
 * Configurable via env (no redeploy of code needed to tweak policy):
 *  - ROBOTS_BLOCK_FACETS=false        → stop blocking faceted query URLs
 *  - ROBOTS_DISALLOW_EXTRA=/x,/y      → append extra disallowed paths
 *  - ROBOTS_ALLOW_INDEXING=false      → block everything (staging/preview)
 */

const PRIVATE_PATHS = [
  "/admin",
  "/superadmin",
  "/dashboard",
  "/api/",
  "/checkout",
  "/account",
  "/cart",
  "/wishlist",
];

/**
 * Query keys that produce duplicate/faceted listing URLs. We block any URL
 * containing them via the `/*<key>=` wildcard (matches the key in any param
 * position). `q` (search) is included - search results are intentionally
 * non-indexable.
 */
const FACETED_PARAM_KEYS = ["sort", "page", "brand", "category", "price", "tags", "rating", "q", "utm_"];

function facetedDisallows(): string[] {
  return FACETED_PARAM_KEYS.map((k) => `/*${k}=`);
}

function envFlag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v !== "false" && v !== "0";
}

function extraDisallows(): string[] {
  return (process.env.ROBOTS_DISALLOW_EXTRA ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// AI / generative-engine crawlers we explicitly allow for GEO coverage.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  // Hard block everything on non-production / preview environments.
  if (!envFlag("ROBOTS_ALLOW_INDEXING", true)) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${SITE_URL}/sitemap.xml`,
    };
  }

  const disallow = [
    ...PRIVATE_PATHS,
    ...(envFlag("ROBOTS_BLOCK_FACETS", true) ? facetedDisallows() : []),
    ...extraDisallows(),
  ];

  return {
    rules: [
      // Search-engine crawlers (Googlebot, Bingbot, …) inherit this default.
      { userAgent: "*", allow: "/", disallow },
      // AI crawlers - same access; listed explicitly to signal intent and stay
      // robust against crawlers that default to "disallow unless named".
      { userAgent: AI_CRAWLERS, allow: "/", disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

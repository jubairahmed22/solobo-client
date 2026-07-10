/**
 * Sitemap infrastructure - index + sharded child sitemaps, built to scale past
 * the 50,000-URL / 50MB-per-file limits search engines impose.
 *
 * Topology:
 *   /sitemap.xml          → <sitemapindex> listing every child sitemap
 *   /sitemap-index.xml    → same index (alias)
 *   /sitemaps/pages.xml        → static + CMS pages
 *   /sitemaps/categories.xml   → all categories
 *   /sitemaps/brands.xml       → all brands
 *   /sitemaps/products-0.xml … → products, sharded at URLS_PER_SITEMAP each
 *
 * Data comes from the public API; the product list caps at 500/page, so a shard
 * is filled by looping a bounded number of API pages. All fetches degrade
 * gracefully (a backend hiccup yields a smaller/empty sitemap, never a 500).
 * Every entry carries <lastmod> from the resource's updatedAt.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";

/** URLs per child sitemap. Well under the 50k hard cap; configurable. */
export const URLS_PER_SITEMAP = Number(process.env.SITEMAP_URLS_PER_FILE ?? 5000);
/** Public product-list page size cap (see catalog.schema). */
const API_PAGE = 500;
/** Safety cap so a misconfigured backend can't make us loop forever. */
const MAX_API_PAGES_PER_SHARD = Math.ceil(URLS_PER_SITEMAP / API_PAGE);

export interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

interface ProductRow {
  slug: string;
  updatedAt?: string;
}
interface CategoryRow {
  path?: string;
  slug?: string;
  updatedAt?: string;
}
interface BrandRow {
  slug: string;
  updatedAt?: string;
}

/* ───────────────────── XML serialization ───────────────────── */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function abs(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function isoDate(input?: string): string | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Serialize a <urlset> document. */
export function urlsetXml(entries: UrlEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`<loc>${escapeXml(abs(e.loc))}</loc>`];
      if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

/** Serialize a <sitemapindex> document. */
export function sitemapIndexXml(items: Array<{ loc: string; lastmod?: string }>): string {
  const body = items
    .map((s) => {
      const parts = [`<loc>${escapeXml(abs(s.loc))}</loc>`];
      if (s.lastmod) parts.push(`<lastmod>${s.lastmod}</lastmod>`);
      return `<sitemap>${parts.join("")}</sitemap>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

/* ───────────────────── Data fetchers ───────────────────── */

async function fetchList<T>(
  url: string,
  revalidate: number,
): Promise<{ data: T[]; total: number }> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return { data: [], total: 0 };
    const body = (await res.json()) as {
      success?: boolean;
      data?: T[];
      meta?: { total?: number; totalPages?: number };
    };
    if (!body.success || !Array.isArray(body.data)) return { data: [], total: 0 };
    return { data: body.data, total: body.meta?.total ?? body.data.length };
  } catch {
    return { data: [], total: 0 };
  }
}

const REVALIDATE = Number(process.env.SITEMAP_REVALIDATE ?? 3600);

/** Total active products - drives how many product shards the index lists. */
export async function getProductTotal(): Promise<number> {
  const { total } = await fetchList<ProductRow>(`${API_URL}/api/products?limit=1`, REVALIDATE);
  return total;
}

/** Number of product shards needed for the current catalog (min 1). */
export async function getProductShardCount(): Promise<number> {
  const total = await getProductTotal();
  return Math.max(1, Math.ceil(total / URLS_PER_SITEMAP));
}

/** Product URL entries for shard `index` (0-based), filled across API pages. */
export async function getProductShard(index: number): Promise<UrlEntry[]> {
  const entries: UrlEntry[] = [];
  const startOffset = index * URLS_PER_SITEMAP;
  for (let i = 0; i < MAX_API_PAGES_PER_SHARD; i += 1) {
    const apiPage = Math.floor(startOffset / API_PAGE) + i + 1;
    const { data } = await fetchList<ProductRow>(
      `${API_URL}/api/products?limit=${API_PAGE}&page=${apiPage}&sort=newest`,
      REVALIDATE,
    );
    if (data.length === 0) break;
    for (const p of data) {
      if (!p.slug) continue;
      entries.push({
        loc: `/product/${p.slug}`,
        lastmod: isoDate(p.updatedAt),
        changefreq: "weekly",
        priority: 0.8,
      });
      if (entries.length >= URLS_PER_SITEMAP) return entries;
    }
    if (data.length < API_PAGE) break;
  }
  return entries;
}

/** All category URL entries (flat). */
export async function getCategoryEntries(): Promise<UrlEntry[]> {
  const entries: UrlEntry[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data } = await fetchList<CategoryRow>(
      `${API_URL}/api/categories?shape=flat&limit=${API_PAGE}&page=${page}`,
      REVALIDATE,
    );
    if (data.length === 0) break;
    for (const c of data) {
      const path = c.path ?? c.slug;
      if (!path) continue;
      entries.push({
        loc: `/category/${path}`,
        lastmod: isoDate(c.updatedAt),
        changefreq: "daily",
        priority: 0.7,
      });
    }
    if (data.length < API_PAGE) break;
  }
  return entries;
}

/** All brand URL entries. */
export async function getBrandEntries(): Promise<UrlEntry[]> {
  const entries: UrlEntry[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data } = await fetchList<BrandRow>(
      `${API_URL}/api/brands?isActive=true&limit=${API_PAGE}&page=${page}`,
      REVALIDATE,
    );
    if (data.length === 0) break;
    for (const b of data) {
      if (!b.slug) continue;
      entries.push({
        loc: `/brands/${b.slug}`,
        lastmod: isoDate(b.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }
    if (data.length < API_PAGE) break;
  }
  return entries;
}

/**
 * Static + CMS page entries. Edit this list (or wire it to a CMS collection)
 * to control which evergreen pages are indexed. Excludes private/utility
 * routes - those are blocked in robots.ts.
 */
export function getStaticPageEntries(): UrlEntry[] {
  const now = new Date().toISOString();
  const make = (loc: string, priority: number, changefreq: UrlEntry["changefreq"]): UrlEntry => ({
    loc,
    lastmod: now,
    changefreq,
    priority,
  });
  return [
    make("/", 1.0, "daily"),
    make("/all-products", 0.9, "hourly"),
    make("/brands", 0.6, "weekly"),
    make("/offers", 0.6, "daily"),
    make("/search", 0.4, "monthly"),
  ];
}

/* ───────────────────── Index ───────────────────── */

/** Build the list of child sitemaps for the index document. */
export async function buildSitemapIndex(): Promise<Array<{ loc: string; lastmod?: string }>> {
  const now = new Date().toISOString();
  const shardCount = await getProductShardCount();
  const items: Array<{ loc: string; lastmod?: string }> = [
    { loc: "/sitemaps/pages.xml", lastmod: now },
    { loc: "/sitemaps/categories.xml", lastmod: now },
    { loc: "/sitemaps/brands.xml", lastmod: now },
  ];
  for (let i = 0; i < shardCount; i += 1) {
    items.push({ loc: `/sitemaps/products-${i}.xml`, lastmod: now });
  }
  return items;
}

export { REVALIDATE as SITEMAP_REVALIDATE };

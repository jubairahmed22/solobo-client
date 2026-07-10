import type { Metadata } from "next";
import type { BrandDetail, CategoryDetail, ProductDetail } from "@/types/catalog";
import { COMPANY } from "@/lib/entity/company";

/**
 * Centralized metadata framework (Next.js Metadata API).
 *
 * One builder, `buildMetadata`, produces a complete + consistent Metadata
 * object - title, description, canonical, OpenGraph, Twitter Card - and the
 * per-type helpers below feed it from a Product / Category / Brand / content
 * page / the homepage. Every route's `generateMetadata` (or static `metadata`)
 * should go through here so the tags never drift.
 *
 * Two deliberate choices:
 *  - We set `title.absolute` rather than a plain string. The root layout
 *    defines a `%s · Solobo` template; using `absolute` means THIS module
 *    owns the full title and we never risk double-suffixing (e.g. when a
 *    seller-authored metaTitle already contains the brand).
 *  - We always emit a FULL openGraph + twitter block. Next shallow-merges
 *    metadata, so a page that sets `openGraph` replaces the layout's entirely -
 *    re-emitting siteName/locale/type here keeps social cards complete.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = COMPANY.name;
const LOCALE = "en_BD";
const ALT_LOCALE = ["bn_BD"];
const TITLE_SEP = " · ";
const DESC_MAX = 200;

export interface MetaImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export type OgType = "website" | "article";

export interface BuildMetadataInput {
  /** Page-specific title WITHOUT the brand suffix (we add it). */
  title: string;
  description?: string;
  /** Canonical path (e.g. "/product/foo") or absolute URL; "/" for home. */
  path: string;
  images?: MetaImage[];
  ogType?: OgType;
  keywords?: string[];
  /** Pages that shouldn't be indexed (thin/listing/utility). */
  noIndex?: boolean;
}

/** Resolve a path or absolute URL to an absolute, canonical URL. */
function absUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

/**
 * Build a dynamic Open Graph image URL pointing at the edge `@vercel/og`
 * routes (`/api/og/{type}`). Data is passed via query params and rendered into
 * a branded 1200×630 card at request time - no static asset to maintain.
 */
export function ogImageUrl(
  type: "product" | "category" | "blog",
  params: Record<string, string | number | undefined | null>,
): MetaImage {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== "") qs.set(k, String(v));
  }
  return {
    url: `${SITE_URL}/api/og/${type}?${qs.toString()}`,
    width: 1200,
    height: 630,
  };
}

/** Collapse whitespace + clamp to a search-friendly length. */
function normalizeDescription(d?: string): string | undefined {
  if (!d) return undefined;
  const text = d.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > DESC_MAX ? `${text.slice(0, DESC_MAX - 1).trimEnd()}…` : text;
}

/** Append " · Solobo" unless the title already references the brand. */
function withBrand(title: string): string {
  const t = title.trim();
  return t.toLowerCase().includes(SITE_NAME.toLowerCase()) ? t : `${t}${TITLE_SEP}${SITE_NAME}`;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const canonical = absUrl(input.path);
  const fullTitle = withBrand(input.title);
  const description = normalizeDescription(input.description);

  const images = (input.images ?? [])
    .filter((i) => i.url)
    .map((i) => ({
      url: absUrl(i.url),
      alt: i.alt ?? input.title,
      ...(i.width ? { width: i.width } : {}),
      ...(i.height ? { height: i.height } : {}),
    }));

  return {
    // `absolute` bypasses the root layout's title template - this module owns
    // the complete <title>.
    title: { absolute: fullTitle },
    description,
    keywords: input.keywords && input.keywords.length > 0 ? input.keywords : undefined,
    alternates: { canonical },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: input.ogType ?? "website",
      url: canonical,
      siteName: SITE_NAME,
      locale: LOCALE,
      alternateLocale: ALT_LOCALE,
      title: fullTitle,
      description,
      ...(images.length > 0 ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(images.length > 0 ? { images: images.map((i) => i.url) } : {}),
    },
  };
}

/* ───────────────────── Per-type helpers ───────────────────── */

/** Product detail page (`/product/[slug]`). */
export function productMetadata(p: ProductDetail): Metadata {
  const brandName = typeof p.brand === "object" && p.brand ? p.brand.name : undefined;
  const rating = p.ratingCount > 0 ? p.ratingAverage.toFixed(1) : undefined;
  return buildMetadata({
    title: p.metaTitle ?? p.title,
    description: p.metaDescription ?? p.shortDescription ?? p.description,
    path: `/product/${p.slug}`,
    // Dynamic branded OG card (1200×630). The real product photo stays for
    // structured data; the social card is generated.
    images: [
      ogImageUrl("product", {
        title: p.title,
        brand: brandName,
        price: p.price.toLocaleString("en-IN"),
        rating,
      }),
    ],
    keywords: p.tags && p.tags.length > 0 ? p.tags : undefined,
    // Product semantics live in ProductJsonLd; OG stays "website" (Next's typed
    // OpenGraph union doesn't include "product").
    ogType: "website",
  });
}

/** Category listing page (`/category/[...slug]`). */
export function categoryMetadata(c: CategoryDetail): Metadata {
  return buildMetadata({
    title: c.metaTitle ?? c.name,
    description:
      c.metaDescription ??
      c.description ??
      `Shop ${c.name} at ${SITE_NAME} - performance sportswear and casualwear. Fast delivery nationwide.`,
    path: `/category/${c.path}`,
    images: [ogImageUrl("category", { title: c.name })],
  });
}

/**
 * Brand page. `path` defaults to a brand detail route; pass an explicit path
 * (e.g. `/all-products?brand=slug`) when the brand is surfaced elsewhere.
 */
export function brandMetadata(b: BrandDetail, path?: string): Metadata {
  return buildMetadata({
    title: b.metaTitle ?? `${b.name} products`,
    description:
      b.metaDescription ??
      b.description ??
      `Shop ${b.name} at ${SITE_NAME}. Performance gear and casualwear. Fast delivery nationwide.`,
    path: path ?? `/brands/${b.slug}`,
    images: b.logo ? [{ url: b.logo, alt: b.name }] : undefined,
  });
}

/** Generic content/landing page (offers, policies, editorial, directories). */
export function contentMetadata(input: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  imageAlt?: string;
  ogType?: OgType;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  return buildMetadata({
    title: input.title,
    description: input.description,
    path: input.path,
    images: input.image ? [{ url: input.image, alt: input.imageAlt ?? input.title }] : undefined,
    ogType: input.ogType ?? "article",
    keywords: input.keywords,
    noIndex: input.noIndex,
  });
}

/** Homepage (`/`). */
export function homeMetadata(): Metadata {
  return buildMetadata({
    title: "Solobo - Performance Sportswear & Casualwear",
    description:
      "Shop performance sportswear, casualwear and activewear. Built for every level - gym, street and everything in between. Fast delivery nationwide.",
    path: "/",
    keywords: [
      "sportswear bangladesh",
      "gym wear dhaka",
      "activewear",
      "casual wear",
      "performance clothing",
      "workout clothes bangladesh",
    ],
  });
}

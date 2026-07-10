import * as React from "react";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebsiteJsonLd,
  type Availability,
  type ProductReviewInput,
} from "@/lib/seo/jsonld";

/**
 * Render a <script type="application/ld+json">. The payload is produced by the
 * pure builders in lib/seo/jsonld.ts (single source of truth, unit-tested),
 * so these components are thin renderers. `dangerouslySetInnerHTML` is safe -
 * the object is fully constructed server-side from typed args.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/* ───────────────────────── Product ───────────────────────── */

export interface ProductLdInput {
  name: string;
  description: string;
  sku?: string;
  brand?: string;
  images: string[]; // absolute URLs
  url: string; // canonical
  price: number;
  priceCurrency?: string; // default BDT
  availability?: Availability;
  ratingValue?: number;
  reviewCount?: number;
  /** Optional individual reviews (renders Review nodes). */
  reviews?: ProductReviewInput[];
}

export function ProductJsonLd(p: ProductLdInput) {
  const data = buildProductJsonLd({
    name: p.name,
    description: p.description,
    sku: p.sku,
    brand: p.brand,
    images: p.images,
    url: p.url,
    price: p.price,
    priceCurrency: p.priceCurrency,
    availability: p.availability,
    aggregateRating:
      p.ratingValue && p.reviewCount
        ? { ratingValue: p.ratingValue, reviewCount: p.reviewCount }
        : undefined,
    reviews: p.reviews,
  });
  return <JsonLd data={data} />;
}

/* ───────────────────────── Breadcrumb ───────────────────────── */

export interface BreadcrumbLdInput {
  items: Array<{ name: string; url: string }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbLdInput) {
  return <JsonLd data={buildBreadcrumbJsonLd({ items })} />;
}

/* ───────────────────────── Organization ───────────────────────── */

export interface OrganizationLdInput {
  url: string;
  logo: string;
  sameAs?: string[];
  contact?: {
    telephone?: string;
    email?: string;
    contactType?: string;
    areaServed?: string;
  };
}

export function OrganizationJsonLd({ url, logo, sameAs, contact }: OrganizationLdInput) {
  return <JsonLd data={buildOrganizationJsonLd({ url, logo, sameAs, contact })} />;
}

/* ───────────────────────── WebSite ───────────────────────── */

export function WebsiteJsonLd({ url }: { url: string }) {
  return <JsonLd data={buildWebsiteJsonLd({ url })} />;
}

/* ───────────────────────── FAQ ───────────────────────── */

export interface FaqLdInput {
  items: Array<{ question: string; answer: string }>;
}

/** Renders nothing when there are no FAQs, so callers can pass through freely. */
export function FaqJsonLd({ items }: FaqLdInput) {
  if (!items || items.length === 0) return null;
  return <JsonLd data={buildFaqJsonLd({ items })} />;
}

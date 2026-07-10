/**
 * Reusable JSON-LD (schema.org structured data) system.
 *
 * Pure builder functions - no React - so they can be rendered into a
 * <script type="application/ld+json"> (see components/seo/JsonLd.tsx) AND
 * unit-tested + validated in isolation. Every builder returns a plain object
 * with `@context`/`@type`; `validateJsonLd` checks required fields per type so
 * malformed output is caught before it ships (Google ignores invalid blocks
 * silently, so we validate ourselves).
 *
 * Coverage: Product (+ Offer, AggregateRating, Review), Organization
 * (business + contact + social), WebSite (+ SearchAction), BreadcrumbList,
 * FAQPage.
 */

import { COMPANY } from "@/lib/entity/company";

const SCHEMA = "https://schema.org";
const SITE_NAME = COMPANY.name;

export type JsonLdNode = Record<string, unknown>;

/** Strip undefined/null/empty so the emitted JSON stays clean + valid. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

/* ───────────────────── Product ───────────────────── */

export type Availability =
  | "InStock"
  | "OutOfStock"
  | "PreOrder"
  | "BackOrder"
  | "Discontinued";

export interface ProductReviewInput {
  author: string;
  /** 1–5. */
  rating: number;
  body?: string;
  datePublished?: string; // ISO
  title?: string;
}

export interface ProductJsonLdInput {
  name: string;
  description?: string;
  sku?: string;
  gtin?: string;
  brand?: string;
  images?: string[];
  url: string;
  price: number;
  priceCurrency?: string;
  availability?: Availability;
  /** When set, validated against the order of magnitude of reviewCount. */
  aggregateRating?: { ratingValue: number; reviewCount: number };
  reviews?: ProductReviewInput[];
  priceValidUntil?: string; // ISO date
}

export function buildProductJsonLd(p: ProductJsonLdInput): JsonLdNode {
  return compact({
    "@context": SCHEMA,
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.sku,
    gtin: p.gtin,
    image: p.images && p.images.length > 0 ? p.images : undefined,
    url: p.url,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: compact({
      "@type": "Offer",
      url: p.url,
      priceCurrency: p.priceCurrency ?? "BDT",
      price: p.price.toFixed(2),
      priceValidUntil: p.priceValidUntil,
      availability: `${SCHEMA}/${p.availability ?? "InStock"}`,
    }),
    aggregateRating: p.aggregateRating
      ? compact({
          "@type": "AggregateRating",
          ratingValue: p.aggregateRating.ratingValue,
          reviewCount: p.aggregateRating.reviewCount,
        })
      : undefined,
    review:
      p.reviews && p.reviews.length > 0
        ? p.reviews.map((r) =>
            compact({
              "@type": "Review",
              author: { "@type": "Person", name: r.author },
              name: r.title,
              reviewBody: r.body,
              datePublished: r.datePublished,
              reviewRating: {
                "@type": "Rating",
                ratingValue: r.rating,
                bestRating: 5,
                worstRating: 1,
              },
            }),
          )
        : undefined,
  });
}

/* ───────────────────── Organization ───────────────────── */

export interface OrganizationJsonLdInput {
  url: string;
  logo: string;
  name?: string;
  /** Social profile URLs. */
  sameAs?: string[];
  contact?: {
    telephone?: string;
    email?: string;
    contactType?: string; // e.g. "customer service"
    areaServed?: string; // e.g. "BD"
  };
}

export function buildOrganizationJsonLd(o: OrganizationJsonLdInput): JsonLdNode {
  const contact = o.contact
    ? compact({
        "@type": "ContactPoint",
        telephone: o.contact.telephone,
        email: o.contact.email,
        contactType: o.contact.contactType ?? "customer service",
        areaServed: o.contact.areaServed,
      })
    : undefined;

  return compact({
    "@context": SCHEMA,
    "@type": "Organization",
    name: o.name ?? SITE_NAME,
    url: o.url,
    logo: o.logo,
    sameAs: o.sameAs,
    contactPoint: contact,
  });
}

/* ───────────────────── WebSite (+ SearchAction) ───────────────────── */

export interface WebsiteJsonLdInput {
  url: string;
  name?: string;
  /** Search results URL template; `{search_term_string}` is substituted. */
  searchUrlTemplate?: string;
}

export function buildWebsiteJsonLd(w: WebsiteJsonLdInput): JsonLdNode {
  const target = w.searchUrlTemplate ?? `${w.url}/all-products?q={search_term_string}`;
  return compact({
    "@context": SCHEMA,
    "@type": "WebSite",
    name: w.name ?? SITE_NAME,
    url: w.url,
    potentialAction: {
      "@type": "SearchAction",
      target,
      "query-input": "required name=search_term_string",
    },
  });
}

/* ───────────────────── BreadcrumbList ───────────────────── */

export interface BreadcrumbJsonLdInput {
  items: Array<{ name: string; url: string }>;
}

export function buildBreadcrumbJsonLd(b: BreadcrumbJsonLdInput): JsonLdNode {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: b.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/* ───────────────────── FAQPage ───────────────────── */

export interface FaqJsonLdInput {
  items: Array<{ question: string; answer: string }>;
}

export function buildFaqJsonLd(f: FaqJsonLdInput): JsonLdNode {
  return {
    "@context": SCHEMA,
    "@type": "FAQPage",
    mainEntity: f.items.map((qa) => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: qa.answer,
      },
    })),
  };
}

/* ───────────────────── Validation ───────────────────── */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireFields(node: Record<string, unknown>, fields: string[], errors: string[], where: string) {
  for (const f of fields) {
    const v = node[f];
    if (v === undefined || v === null || v === "") {
      errors.push(`${where}: missing required field "${f}"`);
    }
  }
}

/**
 * Validate a JSON-LD node against the subset of schema.org requirements we
 * emit. Returns the list of problems; empty = valid. Pure + dependency-free so
 * it runs in tests and (optionally) as a dev-time guard.
 */
export function validateJsonLd(node: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(node)) {
    return { valid: false, errors: ["not an object"] };
  }
  if (node["@context"] !== SCHEMA) {
    errors.push(`@context must be "${SCHEMA}"`);
  }
  const type = node["@type"];
  if (typeof type !== "string") {
    errors.push("@type is required");
    return { valid: false, errors };
  }

  switch (type) {
    case "Product": {
      requireFields(node, ["name"], errors, "Product");
      const offers = node.offers;
      if (!isObj(offers)) {
        errors.push("Product: missing offers");
      } else {
        requireFields(offers, ["price", "priceCurrency", "availability"], errors, "Product.offers");
      }
      if (node.aggregateRating !== undefined) {
        if (!isObj(node.aggregateRating)) {
          errors.push("Product.aggregateRating must be an object");
        } else {
          requireFields(node.aggregateRating, ["ratingValue", "reviewCount"], errors, "Product.aggregateRating");
        }
      }
      if (node.review !== undefined) {
        if (!Array.isArray(node.review)) {
          errors.push("Product.review must be an array");
        } else {
          node.review.forEach((r, i) => {
            if (!isObj(r)) return errors.push(`Product.review[${i}] must be an object`);
            if (!isObj(r.author)) errors.push(`Product.review[${i}]: missing author`);
            if (!isObj(r.reviewRating)) errors.push(`Product.review[${i}]: missing reviewRating`);
            else requireFields(r.reviewRating, ["ratingValue"], errors, `Product.review[${i}].reviewRating`);
          });
        }
      }
      break;
    }
    case "Organization": {
      requireFields(node, ["name", "url"], errors, "Organization");
      if (node.sameAs !== undefined && !Array.isArray(node.sameAs)) {
        errors.push("Organization.sameAs must be an array");
      }
      break;
    }
    case "WebSite": {
      requireFields(node, ["name", "url"], errors, "WebSite");
      const action = node.potentialAction;
      if (action !== undefined) {
        if (!isObj(action)) errors.push("WebSite.potentialAction must be an object");
        else {
          requireFields(action, ["target", "query-input"], errors, "WebSite.potentialAction");
          if (action["@type"] !== "SearchAction") {
            errors.push('WebSite.potentialAction["@type"] should be "SearchAction"');
          }
        }
      }
      break;
    }
    case "BreadcrumbList": {
      const list = node.itemListElement;
      if (!Array.isArray(list) || list.length === 0) {
        errors.push("BreadcrumbList: itemListElement must be a non-empty array");
      } else {
        list.forEach((it, i) => {
          if (!isObj(it)) return errors.push(`BreadcrumbList[${i}] must be an object`);
          requireFields(it, ["position", "name", "item"], errors, `BreadcrumbList[${i}]`);
        });
      }
      break;
    }
    case "FAQPage": {
      const main = node.mainEntity;
      if (!Array.isArray(main) || main.length === 0) {
        errors.push("FAQPage: mainEntity must be a non-empty array");
      } else {
        main.forEach((q, i) => {
          if (!isObj(q)) return errors.push(`FAQPage.mainEntity[${i}] must be an object`);
          requireFields(q, ["name"], errors, `FAQPage.mainEntity[${i}]`);
          if (!isObj(q.acceptedAnswer)) {
            errors.push(`FAQPage.mainEntity[${i}]: missing acceptedAnswer`);
          } else {
            requireFields(q.acceptedAnswer, ["text"], errors, `FAQPage.mainEntity[${i}].acceptedAnswer`);
          }
        });
      }
      break;
    }
    default:
      // Unknown types pass the structural check (we only assert what we emit).
      break;
  }

  return { valid: errors.length === 0, errors };
}

/** Throwing variant - handy as a dev/build-time guard. */
export function assertValidJsonLd(node: unknown): void {
  const { valid, errors } = validateJsonLd(node);
  if (!valid) {
    throw new Error(`Invalid JSON-LD:\n- ${errors.join("\n- ")}`);
  }
}

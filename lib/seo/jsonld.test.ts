import { describe, it, expect } from "vitest";
import {
  buildProductJsonLd,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  validateJsonLd,
} from "./jsonld";

/**
 * Structured-data validation tests. Each builder must emit schema.org-valid
 * JSON-LD; `validateJsonLd` is the contract. We test the happy path for every
 * type plus a few "garbage in → caught" cases so a regression in the builders
 * (or the validator) fails CI rather than silently shipping invalid markup.
 */

describe("Product JSON-LD", () => {
  const product = buildProductJsonLd({
    name: "Hydrating Serum",
    description: "A lightweight hydrating serum.",
    sku: "SER-001",
    brand: "Solobo",
    images: ["https://solobobd.com/p/ser-001.jpg"],
    url: "https://solobobd.com/product/hydrating-serum",
    price: 1299,
    priceCurrency: "BDT",
    availability: "InStock",
    aggregateRating: { ratingValue: 4.6, reviewCount: 42 },
    reviews: [
      { author: "Ayesha", rating: 5, body: "Loved it", datePublished: "2026-01-10" },
    ],
  });

  it("is valid", () => {
    expect(validateJsonLd(product)).toEqual({ valid: true, errors: [] });
  });

  it("includes Product + Offer + AggregateRating + Review", () => {
    expect(product["@type"]).toBe("Product");
    const offers = product.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.price).toBe("1299.00");
    expect(offers.availability).toBe("https://schema.org/InStock");
    const rating = product.aggregateRating as Record<string, unknown>;
    expect(rating.ratingValue).toBe(4.6);
    const reviews = product.review as Array<Record<string, unknown>>;
    expect(reviews).toHaveLength(1);
    expect((reviews[0]!.reviewRating as Record<string, unknown>).ratingValue).toBe(5);
  });

  it("works without optional rating/reviews", () => {
    const minimal = buildProductJsonLd({
      name: "Lip Balm",
      url: "https://solobobd.com/product/lip-balm",
      price: 299,
    });
    expect(validateJsonLd(minimal).valid).toBe(true);
    expect(minimal.aggregateRating).toBeUndefined();
    expect(minimal.review).toBeUndefined();
  });
});

describe("Organization JSON-LD", () => {
  it("includes business info, contact, and social profiles", () => {
    const org = buildOrganizationJsonLd({
      url: "https://solobobd.com",
      logo: "https://solobobd.com/icon.png",
      sameAs: ["https://facebook.com/solobobd", "https://instagram.com/solobobd"],
      contact: { telephone: "+8801000000000", email: "help@solobobd.com", areaServed: "BD" },
    });
    expect(validateJsonLd(org).valid).toBe(true);
    expect(org.name).toBe("Solobo");
    const cp = org.contactPoint as Record<string, unknown>;
    expect(cp["@type"]).toBe("ContactPoint");
    expect(cp.contactType).toBe("customer service");
    expect((org.sameAs as string[]).length).toBe(2);
  });
});

describe("WebSite JSON-LD", () => {
  it("includes a SearchAction", () => {
    const site = buildWebsiteJsonLd({ url: "https://solobobd.com" });
    expect(validateJsonLd(site).valid).toBe(true);
    const action = site.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    expect(String(action.target)).toContain("{search_term_string}");
    expect(action["query-input"]).toBe("required name=search_term_string");
  });
});

describe("BreadcrumbList JSON-LD", () => {
  it("numbers positions from 1", () => {
    const bc = buildBreadcrumbJsonLd({
      items: [
        { name: "Home", url: "https://solobobd.com/" },
        { name: "Skincare", url: "https://solobobd.com/category/skincare" },
        { name: "Hydrating Serum", url: "https://solobobd.com/product/hydrating-serum" },
      ],
    });
    expect(validateJsonLd(bc).valid).toBe(true);
    const items = bc.itemListElement as Array<Record<string, unknown>>;
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
  });
});

describe("FAQPage JSON-LD", () => {
  it("maps Q&A to Question/Answer", () => {
    const faq = buildFaqJsonLd({
      items: [
        { question: "Do you ship nationwide?", answer: "Yes, across Bangladesh." },
        { question: "Is cash on delivery available?", answer: "Yes." },
      ],
    });
    expect(validateJsonLd(faq).valid).toBe(true);
    const main = faq.mainEntity as Array<Record<string, unknown>>;
    expect(main[0]!["@type"]).toBe("Question");
    expect((main[0]!.acceptedAnswer as Record<string, unknown>)["@type"]).toBe("Answer");
  });
});

describe("validateJsonLd catches invalid markup", () => {
  it("flags a wrong @context", () => {
    const r = validateJsonLd({ "@context": "http://example.com", "@type": "Product", name: "x", offers: { "@type": "Offer", price: "1", priceCurrency: "BDT", availability: "x" } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("@context"))).toBe(true);
  });

  it("flags a Product missing offers", () => {
    const r = validateJsonLd({ "@context": "https://schema.org", "@type": "Product", name: "x" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("offers"))).toBe(true);
  });

  it("flags an empty FAQPage", () => {
    const r = validateJsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [] });
    expect(r.valid).toBe(false);
  });

  it("flags a missing @type", () => {
    const r = validateJsonLd({ "@context": "https://schema.org" });
    expect(r.valid).toBe(false);
  });
});

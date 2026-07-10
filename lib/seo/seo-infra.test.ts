import { describe, it, expect } from "vitest";
import { normalizeCanonical, isNonCanonicalRequest } from "./canonical";
import { urlsetXml, sitemapIndexXml } from "./sitemap";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

describe("normalizeCanonical", () => {
  it("strips all query params by default (faceted/sort/page/query)", () => {
    expect(normalizeCanonical("/all-products", "brand=nivea&sort=price&page=3&q=serum")).toBe(
      `${SITE}/all-products`,
    );
  });

  it("strips tracking params", () => {
    expect(normalizeCanonical("/category/skincare", "utm_source=fb&gclid=abc")).toBe(
      `${SITE}/category/skincare`,
    );
  });

  it("keeps only allow-listed params, sorted deterministically", () => {
    const out = normalizeCanonical("/all-products", "page=2&sort=price", { keep: ["page"] });
    expect(out).toBe(`${SITE}/all-products?page=2`);
  });

  it("accepts a Record of searchParams", () => {
    expect(normalizeCanonical("/x", { a: "1", b: ["2", "3"] })).toBe(`${SITE}/x`);
  });

  it("normalizes trailing slashes but preserves root", () => {
    expect(normalizeCanonical("/brands/")).toBe(`${SITE}/brands`);
    expect(normalizeCanonical("/")).toBe(`${SITE}/`);
  });

  it("detects non-canonical (faceted/tracking) requests", () => {
    expect(isNonCanonicalRequest("sort=price")).toBe(true);
    expect(isNonCanonicalRequest("utm_source=x")).toBe(true);
    expect(isNonCanonicalRequest("")).toBe(false);
    expect(isNonCanonicalRequest("color=red")).toBe(false);
  });
});

describe("sitemap XML serializers", () => {
  it("emits a valid urlset with absolute locs + escaped entities", () => {
    const xml = urlsetXml([
      { loc: "/product/a&b", lastmod: "2026-01-01T00:00:00.000Z", changefreq: "weekly", priority: 0.8 },
      { loc: "https://solobobd.com/product/c", priority: 0.5 },
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<urlset");
    // relative loc is absolutized; "&" escaped to "&amp;"
    expect(xml).toContain(`<loc>${SITE}/product/a&amp;b</loc>`);
    // absolute loc passes through unchanged
    expect(xml).toContain("<loc>https://solobobd.com/product/c</loc>");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<priority>0.8</priority>");
  });

  it("emits a valid sitemapindex", () => {
    const xml = sitemapIndexXml([
      { loc: "/sitemaps/products-0.xml", lastmod: "2026-01-01T00:00:00.000Z" },
      { loc: "/sitemaps/categories.xml" },
    ]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain(`<loc>${SITE}/sitemaps/products-0.xml</loc>`);
    expect(xml).toContain("<sitemap><loc>");
    // index entries use <sitemap>, not <url>
    expect(xml).not.toContain("<url>");
  });
});

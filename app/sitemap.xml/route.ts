import { buildSitemapIndex, sitemapIndexXml, SITEMAP_REVALIDATE } from "@/lib/seo/sitemap";

/**
 * GET /sitemap.xml - the sitemap INDEX. Lists every child sitemap (pages,
 * categories, brands, and the product shards). Search engines fetch this first;
 * it's what robots.txt points at. Scales past 50k URLs because the URLs live in
 * the sharded children, not here.
 */
export const revalidate = 3600;

export async function GET() {
  const xml = sitemapIndexXml(await buildSitemapIndex());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_REVALIDATE}, stale-while-revalidate`,
    },
  });
}

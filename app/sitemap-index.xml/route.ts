import { buildSitemapIndex, sitemapIndexXml, SITEMAP_REVALIDATE } from "@/lib/seo/sitemap";

/**
 * GET /sitemap-index.xml - alias of /sitemap.xml. Some crawlers and submission
 * tools expect the conventional "-index" filename; both serve the identical
 * <sitemapindex> so either entry point works.
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

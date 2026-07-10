import {
  getBrandEntries,
  getCategoryEntries,
  getProductShard,
  getStaticPageEntries,
  urlsetXml,
  SITEMAP_REVALIDATE,
  type UrlEntry,
} from "@/lib/seo/sitemap";

/**
 * GET /sitemaps/{file}.xml - a single child sitemap (a <urlset>).
 *
 * Dispatches on the filename the index references:
 *   pages.xml | categories.xml | brands.xml | products-<n>.xml
 *
 * Product shards are paged so the system handles 50k+ product URLs across many
 * files without any single response exceeding the per-file limits.
 */
export const revalidate = 3600;

function xmlResponse(entries: UrlEntry[]): Response {
  return new Response(urlsetXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_REVALIDATE}, stale-while-revalidate`,
    },
  });
}

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  // Strip the .xml extension the index appends.
  const key = params.file.replace(/\.xml$/i, "");

  if (key === "pages") return xmlResponse(getStaticPageEntries());
  if (key === "categories") return xmlResponse(await getCategoryEntries());
  if (key === "brands") return xmlResponse(await getBrandEntries());

  const productShard = /^products-(\d+)$/.exec(key);
  if (productShard) {
    const index = Number(productShard[1]);
    return xmlResponse(await getProductShard(index));
  }

  return new Response("Not found", { status: 404 });
}

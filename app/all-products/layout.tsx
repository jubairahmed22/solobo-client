import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { normalizeCanonical } from "@/lib/seo/canonical";
import { COMPANY } from "@/lib/entity/company";

/**
 * Route-level metadata for /all-products. The page itself is a client component
 * (it owns filter/sort/pagination state from the URL), so it can't export
 * metadata - this layout supplies it instead.
 *
 * The canonical is the CLEAN base URL (`normalizeCanonical` strips every
 * query param), so every faceted / sorted / paginated / searched permutation
 * - `?brand=`, `?sort=`, `?page=`, `?q=`, `?price=` … - canonicalizes here and
 * Google indexes one URL instead of thousands of near-duplicates. robots.txt
 * additionally blocks crawling those param URLs.
 */
export const metadata: Metadata = buildMetadata({
  title: "All products",
  description:
    `Browse the full ${COMPANY.name} catalog - sportswear, casualwear and activewear. Filter by brand, category and price.`,
  path: normalizeCanonical("/all-products"),
});

export default function AllProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

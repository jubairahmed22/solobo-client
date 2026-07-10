import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { BreadcrumbJsonLd } from "@/components/seo";
import { categoryMetadata } from "@/lib/seo/metadata";
import type { ApiResponse } from "@/types/api";
import type { CategoryDetail, ProductSummary, BrandDetail } from "@/types/catalog";
import type { Offer, OfferBanner, PublicListOffersResponse } from "@/types/offer";
import { CategoryProductsClient } from "./CategoryProductsClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface PageProps {
  params: { slug: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}

// React.cache dedupes the category fetch shared by generateMetadata + the page.
const fetchCategory = cache(async (path: string): Promise<CategoryDetail | null> => {
  // Multi-segment paths must use the `/by-path/*` wildcard route - the
  // single-segment `/:slug` route can't capture "face/lips" even when the
  // slash is %2F-encoded (Express doesn't transparently re-route those).
  const url = path.includes("/")
    ? `${API_URL}/api/categories/by-path/${path}`
    : `${API_URL}/api/categories/${encodeURIComponent(path)}`;
  try {
    const res = await axios.get<ApiResponse<CategoryDetail>>(url, {
      timeout: 8000,
    });
    return res.data.success ? res.data.data : null;
  } catch {
    return null;
  }
});

async function fetchInitialProducts(
  categoryPath: string,
): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(
      `${API_URL}/api/products`,
      {
        params: { categoryPath, limit: 24, sort: "newest" },
        timeout: 8000,
      },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

async function fetchBrands(): Promise<BrandDetail[]> {
  try {
    const res = await axios.get<ApiResponse<BrandDetail[]>>(`${API_URL}/api/brands`, {
      params: { isActive: true, limit: 100 },
      timeout: 8000,
    });
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

/**
 * Pull active offers whose product set intersects this category. The backend
 * filters via the `category` query param (expects an ObjectId), so we pass
 * the resolved category's `_id`. Used to render the top banner strip on
 * category pages when at least one offer is running on these products.
 */
async function fetchCategoryOffers(categoryId: string): Promise<Offer[]> {
  try {
    const res = await axios.get<ApiResponse<PublicListOffersResponse>>(
      `${API_URL}/api/offers`,
      {
        params: { category: categoryId, sort: "ends-soonest", limit: 6 },
        timeout: 8000,
      },
    );
    if (!res.data.success) return [];
    // Honor the per-offer toggle the admin uses to decide whether the
    // campaign should surface on category pages - drafts/test offers can be
    // hidden there even when live elsewhere.
    return res.data.data.offers.filter((o) => o.showOnCategoryStrip);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const path = params.slug.join("/");
  const cat = await fetchCategory(path);
  if (!cat) {
    return { title: "Category not found" };
  }
  return categoryMetadata(cat);
}

export default async function CategoryPage({ params }: PageProps) {
  const path = params.slug.join("/");
  const [category, initialProducts, brands] = await Promise.all([
    fetchCategory(path),
    fetchInitialProducts(path),
    fetchBrands(),
  ]);
  if (!category) notFound();

  // Offers depend on the resolved category id, so this fetch chains. The
  // round-trip is acceptable - category pages already revalidate at the
  // route level (Next defaults) and offers change on a slow cadence.
  const categoryOffers = await fetchCategoryOffers(category._id);

  // Flatten + deep-link slides the same way the homepage does. Slides that
  // don't carry an explicit CTA fall through to their owning offer's landing
  // page so the affordance always has a destination.
  const categoryBanners: OfferBanner[] = categoryOffers.flatMap((offer) =>
    offer.banners
      .filter((b) => b.isActive)
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        ...b,
        ctaHref: b.ctaHref || `/offers/${offer.slug}`,
        ctaLabel: b.ctaLabel || "Shop the offer",
      })),
  );

  const crumbs = [
    { label: "Home", href: "/" },
    ...path.split("/").map((segment, i, all) => {
      const href = `/category/${all.slice(0, i + 1).join("/")}`;
      // Use slug as fallback label; in practice we'd want a per-segment lookup but
      // path resolution above already validated the leaf, so this is good enough for SEO.
      return {
        label: i === all.length - 1 ? category.name : segment.replace(/-/g, " "),
        href: i === all.length - 1 ? undefined : href,
      };
    }),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-ink">
      <Navbar />
      {/* Same two-column layout as /all-products: filter sidebar + content
          panel. The breadcrumb, offer banner, heading and grid all live inside
          the client so the sidebar can stay interactive. */}
      <main className="mx-auto flex w-full flex-1 gap-2 px-0 pb-16 pt-2 sm:px-4 sm:pb-2 md:px-6 lg:w-[82%]">
        <CategoryProductsClient
          categoryPath={path}
          categoryName={category.name}
          categoryDescription={category.description}
          crumbs={crumbs}
          banners={categoryBanners}
          initialProducts={initialProducts}
          brands={brands}
        />
      </main>
      <Footer />

      <BreadcrumbJsonLd
        items={crumbs
          .filter((c) => c.href || c.label === category.name)
          .map((c) => ({ name: c.label, url: c.href ? `${SITE_URL}${c.href}` : `${SITE_URL}/category/${path}` }))}
      />
    </div>
  );
}

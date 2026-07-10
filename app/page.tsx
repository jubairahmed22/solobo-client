import type { Metadata } from "next";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import type {
  BrandLite,
  CategoryNode,
  SubCategory,
  ChildCategory,
} from "@/components/layout";
import {
  HeroBanner,
  CategoryTiles,
  ProductRow,
  TrustStrip,
  OfferBannerCarousel,
} from "@/components/composed";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/seo";
import { homeMetadata } from "@/lib/seo/metadata";
import type { ApiResponse } from "@/types/api";
import type { BrandDetail, CategoryTreeNode, ProductSummary } from "@/types/catalog";
import type { Offer, OfferBanner, PublicListOffersResponse } from "@/types/offer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 300;

export const metadata: Metadata = homeMetadata();

/* ───────────────────── SSR fetchers ───────────────────── */

async function fetchCategoryTree(): Promise<CategoryTreeNode[]> {
  try {
    const res = await axios.get<ApiResponse<CategoryTreeNode[]>>(
      `${API_URL}/api/categories`,
      { params: { shape: "tree", isActive: true }, timeout: 8000 },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

async function fetchBrands(): Promise<BrandDetail[]> {
  try {
    const res = await axios.get<ApiResponse<BrandDetail[]>>(
      `${API_URL}/api/brands`,
      { params: { isActive: true, limit: 100 }, timeout: 8000 },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

async function fetchFeaturedProducts(): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(
      `${API_URL}/api/products/featured`,
      { params: { limit: 8 }, timeout: 8000 },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

async function fetchNewArrivals(): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(
      `${API_URL}/api/products`,
      { params: { sort: "newest", limit: 8 }, timeout: 8000 },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

async function fetchProductsByCategoryPath(path: string, limit = 8): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(
      `${API_URL}/api/products`,
      { params: { categoryPath: path, sort: "newest", limit }, timeout: 8000 },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

async function fetchHomepageOffers(): Promise<Offer[]> {
  try {
    const res = await axios.get<ApiResponse<PublicListOffersResponse>>(
      `${API_URL}/api/offers`,
      { params: { sort: "ends-soonest", limit: 12 }, timeout: 8000 },
    );
    if (!res.data.success) return [];
    return res.data.data.offers;
  } catch {
    return [];
  }
}

/* ───────────────────── Mappers ───────────────────── */

function toChildCategory(node: CategoryTreeNode): ChildCategory {
  return { name: node.name, slug: node.path };
}

function toSubCategory(node: CategoryTreeNode): SubCategory {
  return {
    name: node.name,
    slug: node.path,
    children: node.children?.length ? node.children.map(toChildCategory) : undefined,
  };
}

function toNavCategory(node: CategoryTreeNode): CategoryNode {
  return {
    name: node.name,
    slug: node.path,
    children: node.children?.length ? node.children.map(toSubCategory) : undefined,
  };
}

/* ───────────────────── Page ───────────────────── */

export default async function HomePage() {
  const [categoryTree, brandList, featured, newArrivals, liveOffers] =
    await Promise.all([
      fetchCategoryTree(),
      fetchBrands(),
      fetchFeaturedProducts(),
      fetchNewArrivals(),
      fetchHomepageOffers(),
    ]);

  const navCategories = categoryTree.map(toNavCategory);
  const navBrands: BrandLite[] = brandList.map((b) => ({
    name: b.name,
    slug: b.slug,
    logo: b.logo,
  }));

  const MAX_SUBCATEGORY_ROWS = 24;
  const subPairs = categoryTree
    .flatMap((parent) => (parent.children ?? []).map((sub) => ({ parent, sub })))
    .slice(0, MAX_SUBCATEGORY_ROWS);

  const subProducts = await Promise.all(
    subPairs.map(({ sub }) => fetchProductsByCategoryPath(sub.path, 8)),
  );

  const categorySections = (() => {
    const byParent = new Map<
      string,
      { parent: CategoryTreeNode; rows: { sub: CategoryTreeNode; products: ProductSummary[] }[] }
    >();
    subPairs.forEach(({ parent, sub }, i) => {
      const products = subProducts[i] ?? [];
      if (products.length === 0) return;
      if (!byParent.has(parent._id)) byParent.set(parent._id, { parent, rows: [] });
      byParent.get(parent._id)!.rows.push({ sub, products });
    });
    return Array.from(byParent.values()).filter((s) => s.rows.length > 0);
  })();

  const carouselOffers = liveOffers.filter((o) => o.showOnHomepage);

  const homepageBanners: OfferBanner[] = carouselOffers.flatMap((offer) =>
    offer.banners
      .filter((b) => b.isActive)
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        ...b,
        ctaHref: b.ctaHref || `/offers/${offer.slug}`,
        ctaLabel: b.ctaLabel || "Shop the offer",
      })),
  );

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100 text-ink">
      <Navbar categories={navCategories} brands={navBrands} />

      {/* Offer carousel - full bleed, above the fold */}
      {homepageBanners.length > 0 ? (
        <OfferBannerCarousel banners={homepageBanners} />
      ) : (
        /* Hero fallback when no live offers are running */
        <HeroBanner
          eyebrow="New Season - 2025"
          headline="Made to Move"
          body="Performance sportswear and 
           engineered for every level. Gym, street, and everything in between."
          primaryCta={{ label: "Shop Now", href: "/all-products" }}
          secondaryCta={{ label: "New Arrivals", href: "/all-products?sort=newest" }}
        />
      )}

      <main className="container-screen flex flex-1 flex-col gap-4 py-3 md:gap-10 md:py-8">
        {/* Category collection tiles — "Shop by Collection" hidden on home page (kept for later use) */}
        {/* {categoryTree.length > 0 ? (
          <CategoryTiles categories={categoryTree} limit={8} />
        ) : null} */}

        {/* Featured products */}
        {featured.length > 0 ? (
          <ProductRow
            title="Featured"
            products={featured}
            viewAllHref="/all-products?sort=popular"
          />
        ) : null}

 

        {/* New arrivals */}
        {newArrivals.length > 0 ? (
          <ProductRow
            title="New Arrivals"
            products={newArrivals}
            viewAllHref="/all-products?sort=newest"
          />
        ) : null}

        {/* Per-category rows */}
        {categorySections.map(({ parent, rows }) => (
          <section key={parent._id} className="flex flex-col gap-3 md:gap-4">
            <h2 className="border-l-[3px] border-accent pl-3 text-sm font-black uppercase tracking-widest text-ink">{parent.name}</h2>
            {rows.map(({ sub, products }) => (
              <ProductRow
                key={sub._id}
                title={sub.name}
                products={products}
                viewAllHref={`/category/${sub.path}`}
              />
            ))}
          </section>
        ))}
      </main>

             {/* Trust strip */}
        <TrustStrip />

      <Footer />

      <OrganizationJsonLd
        url={SITE_URL}
        logo={`${SITE_URL}/logo.png`}
        sameAs={[
          "https://www.facebook.com/solobobd",
          "https://www.instagram.com/solobobd",
        ]}
      />
      <WebsiteJsonLd url={SITE_URL} />
    </div>
  );
}

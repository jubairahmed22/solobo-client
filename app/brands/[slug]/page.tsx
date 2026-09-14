import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { BreadcrumbJsonLd } from "@/components/seo";
import { brandMetadata } from "@/lib/seo/metadata";
import type { ApiResponse } from "@/types/api";
import type { BrandDetail, ProductSummary } from "@/types/catalog";
import { BrandProductsClient } from "./BrandProductsClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface PageProps {
  params: { slug: string };
}

// React.cache dedupes the brand fetch shared by generateMetadata + the page.
const fetchBrand = cache(async (slug: string): Promise<BrandDetail | null> => {
  try {
    const res = await axios.get<ApiResponse<BrandDetail>>(
      `${API_URL}/api/brands/${encodeURIComponent(slug)}`,
      { timeout: 8000 },
    );
    return res.data.success ? res.data.data : null;
  } catch {
    return null;
  }
});

async function fetchInitialProducts(brandSlug: string): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(`${API_URL}/api/products`, {
      params: { brand: brandSlug, limit: 24, sort: "newest" },
      timeout: 8000,
    });
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const brand = await fetchBrand(params.slug);
  if (!brand) return { title: "Brand not found" };
  // Canonical brand landing URL - also what the sitemap emits, and what
  // faceted `/all-products?brand=` URLs canonicalize to.
  return brandMetadata(brand, `/brands/${brand.slug}`);
}

/**
 * Brand listing (`/brands/[slug]`) - a real, indexable URL per brand with the
 * exact same filter-rail/sort/grid/pagination UI as `/all-products` and
 * `/category/[...slug]` (see BrandProductsClient), just with the brand
 * locked in. Replaces the old thin "latest 24, no filters, view-all links
 * out to /all-products" landing page - this IS the full browsing surface
 * now, so brand cards across the site link straight here.
 */
export default async function BrandPage({ params }: PageProps) {
  const [brand, initialProducts, brands] = await Promise.all([
    fetchBrand(params.slug),
    fetchInitialProducts(params.slug),
    fetchBrands(),
  ]);
  if (!brand) notFound();

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Brands", href: "/brands" },
    { label: brand.name },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-ink">
      <Navbar />
      {/* Same two-column layout as /all-products and /category: filter
          sidebar + content panel. The breadcrumb, heading and grid all live
          inside the client so the sidebar can stay interactive. */}
      <main className="mx-auto flex w-full flex-1 gap-2 px-0 pb-16 pt-2 sm:px-4 sm:pb-2 md:px-6 lg:w-[82%]">
        <BrandProductsClient
          brandSlug={brand.slug}
          brandName={brand.name}
          brandDescription={brand.description}
          crumbs={crumbs}
          initialProducts={initialProducts}
          brands={brands}
        />
      </main>
      <Footer />

      <BreadcrumbJsonLd
        items={crumbs.map((c) => ({
          name: c.label,
          url: c.href ? `${SITE_URL}${c.href}` : `${SITE_URL}/brands/${brand.slug}`,
        }))}
      />
    </div>
  );
}

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { Breadcrumb, ProductCard } from "@/components/composed";
import { BreadcrumbJsonLd } from "@/components/seo";
import { brandMetadata } from "@/lib/seo/metadata";
import type { ApiResponse } from "@/types/api";
import type { BrandDetail, ProductSummary } from "@/types/catalog";

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

async function fetchBrandProducts(slug: string): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(`${API_URL}/api/products`, {
      params: { brand: slug, limit: 24, sort: "newest" },
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
  // Canonical brand landing URL - also what the sitemap emits.
  return brandMetadata(brand, `/brands/${brand.slug}`);
}

/**
 * Brand landing page (`/brands/[slug]`). A real, indexable URL per brand - the
 * destination the sitemap's brand entries point at (faceted
 * `/all-products?brand=` URLs are canonicalized away, so brands need their own
 * canonical home). Shows the brand header + its latest products, with a
 * "view all" deep-link into the filtered catalog grid.
 */
export default async function BrandPage({ params }: PageProps) {
  const [brand, products] = await Promise.all([
    fetchBrand(params.slug),
    fetchBrandProducts(params.slug),
  ]);
  if (!brand) notFound();

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Brands", href: "/brands" },
    { label: brand.name },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-3">
        <Breadcrumb items={crumbs} />

        <header className="mt-2 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{brand.name}</h1>
          {brand.description ? (
            <p className="max-w-prose text-sm text-neutral-700">{brand.description}</p>
          ) : null}
        </header>

        {products.length > 0 ? (
          <>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-5">
              {products.map((p) => (
                <li key={p._id} className="flex flex-col">
                  <ProductCard product={p} className="h-full w-full" />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-center">
              <Link
                href={`/all-products?brand=${encodeURIComponent(brand.slug)}`}
                className="text-sm underline-offset-4 hover:underline"
              >
                View all {brand.name} products →
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-4 text-center text-sm text-neutral-600">
            No products from {brand.name} yet - check back soon.
          </p>
        )}
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

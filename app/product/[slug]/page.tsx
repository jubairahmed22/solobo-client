import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { Breadcrumb } from "@/components/composed";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo";
import { productMetadata } from "@/lib/seo/metadata";
import type { ApiResponse } from "@/types/api";
import type { ProductDetail, ProductSummary } from "@/types/catalog";
import type { SiteSettings } from "@/types/siteSettings";
import type { PublicCustomizationConfig } from "@/types/customization";
import { ProductDetailClient } from "./ProductDetailClient";
import { ProductInfoSections } from "./ProductInfoSections";
import { RelatedProducts } from "./RelatedProducts";
import { ReviewsSection } from "./ReviewsSection";
import { QASection } from "./QASection";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface PageProps {
  params: { slug: string };
}

// Wrapped in React.cache so generateMetadata + the page body share a single
// network round-trip per request instead of fetching the same product twice.
const fetchProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  try {
    const res = await axios.get<ApiResponse<ProductDetail>>(
      `${API_URL}/api/products/${encodeURIComponent(slug)}`,
      { timeout: 8000 },
    );
    return res.data.success ? res.data.data : null;
  } catch {
    return null;
  }
});

async function fetchRelated(slug: string): Promise<ProductSummary[]> {
  try {
    const res = await axios.get<ApiResponse<ProductSummary[]>>(
      `${API_URL}/api/products/related/${encodeURIComponent(slug)}`,
      { timeout: 8000 },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

// Site settings drive the server-rendered Shipping / Returns / FAQ blocks so
// AI crawlers get the policy facts in the initial HTML. Best-effort - the
// sections fall back to sensible defaults when the fetch fails.
async function fetchSettings(): Promise<SiteSettings | null> {
  try {
    const res = await axios.get<ApiResponse<SiteSettings>>(`${API_URL}/api/site-settings`, {
      timeout: 8000,
    });
    return res.data.success ? res.data.data : null;
  } catch {
    return null;
  }
}

async function fetchCustomizationConfig(): Promise<PublicCustomizationConfig | null> {
  try {
    const res = await axios.get<ApiResponse<PublicCustomizationConfig>>(
      `${API_URL}/api/customizations`,
      { timeout: 8000 },
    );
    return res.data.success ? res.data.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  if (!product) return { title: "Product not found" };
  return productMetadata(product);
}

export default async function ProductPage({ params }: PageProps) {
  const [product, related, settings, customizationConfig] = await Promise.all([
    fetchProduct(params.slug),
    fetchRelated(params.slug),
    fetchSettings(),
    fetchCustomizationConfig(),
  ]);
  if (!product) notFound();

  const categorySummary =
    typeof product.category === "object" && product.category
      ? product.category
      : null;
  const brandSummary =
    typeof product.brand === "object" && product.brand ? product.brand : null;

  const crumbs = [
    { label: "Home", href: "/" },
    ...(categorySummary
      ? [
          { label: categorySummary.name, href: `/category/${categorySummary.path}` },
        ]
      : []),
    { label: product.title },
  ];

  const url = `${SITE_URL}/product/${product.slug}`;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-4 sm:py-6">
        <Breadcrumb items={crumbs} />
        <ProductDetailClient product={product} customizationConfig={customizationConfig} siteSettings={settings} className="mt-2" />
        <ProductInfoSections product={product} settings={settings} className="mt-4" />
        <ReviewsSection
          productId={product._id}
          fallbackAverage={product.ratingAverage}
          fallbackCount={product.ratingCount}
          className="mt-4"
        />
        <QASection
          productId={product._id}
          sellerId={
            typeof product.seller === "object" && product.seller
              ? product.seller._id
              : typeof product.seller === "string"
                ? product.seller
                : undefined
          }
          className="mt-4"
        />
        {related.length > 0 ? (
          <RelatedProducts products={related} className="mt-4" />
        ) : null}
      </main>
      <Footer />

      <ProductJsonLd
        name={product.title}
        description={
          product.metaDescription ?? product.shortDescription ?? product.description ?? product.title
        }
        sku={product.variants[0]?.sku}
        brand={brandSummary?.name}
        images={product.images.map((i) => i.url)}
        url={url}
        price={product.price}
        priceCurrency={product.currency}
        availability={product.stock > 0 ? "InStock" : "OutOfStock"}
        ratingValue={product.ratingCount > 0 ? product.ratingAverage : undefined}
        reviewCount={product.ratingCount > 0 ? product.ratingCount : undefined}
      />
      <BreadcrumbJsonLd
        items={crumbs.map((c) => ({
          name: c.label,
          url: c.href ? `${SITE_URL}${c.href}` : url,
        }))}
      />
    </div>
  );
}

import * as React from "react";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { Breadcrumb } from "@/components/composed";
import { BreadcrumbJsonLd } from "@/components/seo";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type { PublicSellerStore } from "@/types/catalog";
import { COMPANY } from "@/lib/entity/company";
import { StoreClient } from "./StoreClient";

/**
 * Public seller storefront. The page is server-rendered so:
 *  - the seller's metadata (name, bio) makes it into the document head, and
 *  - the initial product gallery loads without a client-side waterfall.
 *
 * Pagination is driven by `?page=` and handled inside `StoreClient`, which
 * refetches via React Query when the URL changes.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const PAGE_SIZE = 24;

interface PageProps {
  params: { slug: string };
  searchParams: { page?: string };
}

interface StoreResponse {
  data: PublicSellerStore;
  meta?: PaginationMeta;
}

// React.cache dedupes the store fetch shared by generateMetadata + the page
// (keyed on slug+page, so the common first-page render collapses to one call).
const fetchStore = cache(
  async (slug: string, page: number): Promise<StoreResponse | null> => {
    try {
      const res = await axios.get<ApiResponse<PublicSellerStore>>(
        `${API_URL}/api/sellers/${encodeURIComponent(slug)}`,
        { params: { page, limit: PAGE_SIZE }, timeout: 8000 },
      );
      if (!res.data.success) return null;
      return { data: res.data.data, meta: res.data.meta };
    } catch {
      return null;
    }
  },
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const store = await fetchStore(params.slug, 1);
  if (!store) return { title: "Shop not found" };
  const { profile } = store.data;
  const url = `${SITE_URL}/store/${profile.storeSlug}`;
  const description =
    profile.storeBio ?? `Browse products from ${profile.name} on ${COMPANY.name}.`;
  return {
    title: `${profile.name} · Shop`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      title: profile.name,
      description,
      images: profile.avatar ? [{ url: profile.avatar, alt: profile.name }] : undefined,
    },
  };
}

export default async function SellerStorePage({ params, searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const store = await fetchStore(params.slug, page);
  if (!store) notFound();

  const { profile } = store.data;
  const crumbs = [
    { label: "Home", href: "/" },
    { label: profile.name },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-3">
        <Breadcrumb items={crumbs} />
        <StoreClient
          initial={store.data}
          initialMeta={store.meta}
          slug={params.slug}
          pageSize={PAGE_SIZE}
          initialPage={page}
        />
      </main>
      <Footer />

      <BreadcrumbJsonLd
        items={crumbs.map((c) => ({
          name: c.label,
          url: c.href ? `${SITE_URL}${c.href}` : `${SITE_URL}/store/${profile.storeSlug}`,
        }))}
      />
    </div>
  );
}

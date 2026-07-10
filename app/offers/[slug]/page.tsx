import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { Breadcrumb, OfferBannerCarousel } from "@/components/composed";
import { Badge } from "@/components/ui";
import { BreadcrumbJsonLd } from "@/components/seo";
import type { ApiResponse } from "@/types/api";
import type { Offer } from "@/types/offer";
import { OfferProductsClient } from "./OfferProductsClient";
import { COMPANY } from "@/lib/entity/company";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface PageProps {
  params: { slug: string };
}

/* ───────────────────── SSR fetch ───────────────────── */

/**
 * Pull the offer landing payload - backend returns the full Offer doc with
 * `products` populated to OfferProductRef-shaped refs (title/slug/price/etc.).
 * 404s and gone-but-still-linked offers both surface as `null` so the route
 * can render the App Router's not-found page instead of a runtime error.
 */
// React.cache dedupes the offer fetch shared by generateMetadata + the page.
const fetchOffer = cache(async (slug: string): Promise<Offer | null> => {
  try {
    const res = await axios.get<ApiResponse<Offer>>(
      `${API_URL}/api/offers/${encodeURIComponent(slug)}`,
      { timeout: 8000 },
    );
    return res.data.success ? res.data.data : null;
  } catch {
    return null;
  }
});

/* ───────────────────── Metadata ───────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const offer = await fetchOffer(params.slug);
  if (!offer) return { title: "Offer not found" };
  const url = `${SITE_URL}/offers/${offer.slug}`;
  const description =
    offer.description ??
    `${offer.name} - save ${
      offer.discountType === "percentage"
        ? `${offer.discountValue}%`
        : `${offer.currency} ${offer.discountValue}`
    } on selected products.`;
  // First active banner - used as the OG image when present.
  const heroBanner = offer.banners
    .filter((b) => b.isActive)
    .sort((a, b) => a.order - b.order)[0];
  return {
    title: `${offer.name} - Offers - ${COMPANY.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: offer.name,
      description,
      images: heroBanner ? [{ url: heroBanner.image, alt: offer.name }] : undefined,
    },
  };
}

/* ───────────────────── Page ───────────────────── */

export default async function OfferDetailPage({ params }: PageProps) {
  const offer = await fetchOffer(params.slug);
  if (!offer) notFound();

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Offers", href: "/offers" },
    { label: offer.name },
  ];

  const discountLabel =
    offer.discountType === "percentage"
      ? `${offer.discountValue}% OFF`
      : offer.currency === "BDT"
        ? `Tk ${offer.discountValue.toLocaleString("en-IN")} OFF`
        : `${offer.currency} ${offer.discountValue.toLocaleString()} OFF`;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-3">
        <Breadcrumb items={crumbs} />

        <header className="mt-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="solid" className="text-sm">{discountLabel}</Badge>
            <Badge variant="muted" className="text-sm">
              Ends {new Date(offer.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{offer.name}</h1>
          {offer.description ? (
            <p className="max-w-3xl text-sm text-neutral-600">{offer.description}</p>
          ) : null}
        </header>

        {/* Banner carousel - only render when the admin has uploaded slides.
            Empty banners is a legitimate state for a discount-only offer. */}
        {offer.banners.some((b) => b.isActive) ? (
          <div className="mt-3">
            <OfferBannerCarousel banners={offer.banners} />
          </div>
        ) : null}

        {/* Product grid - client component owns the sort/pagination URL state */}
        <div className="mt-4">
          <h2 className="text-xl font-bold tracking-tight">
            Included products
          </h2>
          <p className="text-sm text-neutral-600">
            All prices below already reflect the offer discount.
          </p>
          <OfferProductsClient offer={offer} className="mt-2" />
        </div>
      </main>
      <Footer />

      <BreadcrumbJsonLd
        items={crumbs.map((c) => ({
          name: c.label,
          url: c.href ? `${SITE_URL}${c.href}` : `${SITE_URL}/offers/${offer.slug}`,
        }))}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { Breadcrumb } from "@/components/composed";
import { Badge } from "@/components/ui";
import { BreadcrumbJsonLd } from "@/components/seo";
import type { ApiResponse } from "@/types/api";
import type { Offer, PublicListOffersResponse } from "@/types/offer";
import { COMPANY } from "@/lib/entity/company";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 60; // offers update on a slower cadence than carts; 1m is fine

export const metadata: Metadata = {
  title: `Offers & deals - ${COMPANY.name}`,
  description:
    `Live offers and seasonal campaigns running on ${COMPANY.name}. Discover percentage and fixed discounts across the catalog.`,
  alternates: { canonical: `${SITE_URL}/offers` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/offers`,
    title: `Offers & deals - ${COMPANY.name}`,
    description: `Live offers and seasonal campaigns running on ${COMPANY.name}.`,
  },
};

/* ───────────────────── SSR fetch ───────────────────── */

/**
 * Pull the live offers list. The endpoint already filters to status=active +
 * now ∈ [startsAt, endsAt], so the page just needs to lay them out and pick
 * a hero image. We sort by ends-soonest to keep urgency front of mind - the
 * shopper sees expiring deals first.
 */
async function fetchActiveOffers(): Promise<Offer[]> {
  try {
    const res = await axios.get<ApiResponse<PublicListOffersResponse>>(
      `${API_URL}/api/offers`,
      { params: { sort: "ends-soonest", limit: 48 }, timeout: 8000 },
    );
    return res.data.success ? res.data.data.offers : [];
  } catch {
    return [];
  }
}

/* ───────────────────── Helpers ───────────────────── */

/**
 * Pick the first active banner image (or null when the admin hasn't uploaded
 * one yet). Inactive slides are dropped so a freshly-paused banner doesn't
 * accidentally surface as a card hero.
 */
function heroImage(offer: Offer): { url: string; alt: string } | null {
  const slide = (offer.banners ?? [])
    .filter((b) => b.isActive)
    .sort((a, b) => a.order - b.order)[0];
  if (!slide) return null;
  return { url: slide.image, alt: slide.title ?? offer.name };
}

/**
 * Friendly discount label. Percentage offers get the "X% off" treatment;
 * fixed offers spell out the currency amount because "Tk 200 off" reads
 * better than "200 fixed".
 */
function discountLabel(offer: Offer): string {
  if (offer.discountType === "percentage") return `${offer.discountValue}% OFF`;
  const amount = offer.discountValue.toLocaleString("en-IN");
  if (offer.currency === "BDT") return `Tk ${amount} OFF`;
  return `${offer.currency} ${amount} OFF`;
}

/**
 * Ends-in countdown rendered statically for SSR (re-computed at revalidate).
 * We round down to the nearest unit so "ends in 2 days" stays accurate up
 * to the second day's last second. For sub-hour windows we render minutes.
 */
function endsLabel(endsAt: string): string {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  if (end <= now) return "Ended";
  const mins = Math.floor((end - now) / 60000);
  if (mins < 60) return `Ends in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Ends in ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Ends tomorrow" : `Ends in ${days} days`;
}

/* ───────────────────── Page ───────────────────── */

export default async function OffersIndexPage() {
  const offers = await fetchActiveOffers();

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Offers" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />

      <main className="container-screen flex-1 py-3">
        <Breadcrumb items={crumbs} />

        <header className="mt-1 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Offers & deals</h1>
          <p className="max-w-3xl text-sm text-neutral-600">
            Live discounts across the catalog. Tap any card to see the campaign
            and shop the included products.
          </p>
        </header>

        {offers.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-paper py-6 text-center">
            <p className="text-base font-medium">No active offers right now.</p>
            <p className="text-sm text-neutral-600">
              Check back soon - new campaigns drop most weeks.
            </p>
            <Link
              href="/all-products"
              className="mt-1 text-sm font-medium underline-offset-2 hover:underline"
            >
              Browse the full catalog →
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <li key={offer._id}>
                <OfferCard offer={offer} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />

      <BreadcrumbJsonLd
        items={crumbs.map((c) => ({
          name: c.label,
          url: c.href ? `${SITE_URL}${c.href}` : `${SITE_URL}/offers`,
        }))}
      />
    </div>
  );
}

/* ───────────────────── OfferCard ───────────────────── */

interface OfferCardProps {
  offer: Offer;
}

/**
 * Card pattern: 16:9 hero with the discount pill overlaid top-right, body
 * with name + ends-in line + product count, footer link styled as a "Shop
 * now" CTA. The whole card is a Next <Link> so the click target is the full
 * tile - keyboard navigation lights up the outer ring via focus-visible.
 */
function OfferCard({ offer }: OfferCardProps) {
  const hero = heroImage(offer);
  const ends = endsLabel(offer.endsAt);
  const productCount = offer.products?.length ?? 0;
  return (
    <Link
      href={`/offers/${offer.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-paper transition-colors duration-hover ease-out hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/9] w-full bg-neutral-100">
        {hero ? (
          <Image
            src={hero.url}
            alt={hero.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
            No banner
          </div>
        )}
        <Badge variant="solid" className="absolute right-1 top-1 text-sm">
          {discountLabel(offer)}
        </Badge>
      </div>
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-ink">
          {offer.name}
        </h3>
        {offer.description ? (
          <p className="line-clamp-2 text-sm text-neutral-600">
            {offer.description}
          </p>
        ) : null}
        <div className="mt-0.5 flex items-center justify-between gap-1 text-xs text-neutral-500">
          <span>{ends}</span>
          <span>
            {productCount} product{productCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </Link>
  );
}

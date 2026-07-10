"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProductCard, SortBar, Pagination } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import type {
  Offer,
  OfferProductRef,
} from "@/types/offer";
import type {
  ProductActiveOffer,
  ProductSort,
  ProductSummary,
} from "@/types/catalog";

const PAGE_SIZE = 24;

export interface OfferProductsClientProps {
  offer: Offer;
  className?: string;
}

/**
 * The offer landing page renders the offer's allow-list of products with the
 * discount already baked into the price. We compute the discount locally
 * because the populated `products` list on the public detail endpoint isn't
 * decorated by the pricing engine - it's just the raw catalog projection.
 *
 * Layout-wise this is a slim cousin of the all-products page: SortBar at the
 * top, paginated grid below, no FilterRail (the product set is the offer's
 * curated list - filtering would just confuse the experience). Sort + page
 * state live in the URL so deep-linking and refreshes behave intuitively.
 */
export function OfferProductsClient({ offer, className }: OfferProductsClientProps) {
  const router = useRouter();
  const params = useSearchParams();

  const sort = (params.get("sort") as ProductSort | null) ?? "newest";
  const page = Number(params.get("page") ?? "1") || 1;

  // Pull only populated product refs - the wire schema allows strings here
  // (list endpoints keep payloads light), but the detail endpoint always
  // populates. Narrow defensively to keep TS happy.
  const refs: OfferProductRef[] = React.useMemo(
    () =>
      offer.products.filter(
        (p): p is OfferProductRef => typeof p === "object" && p !== null && "_id" in p,
      ),
    [offer.products],
  );

  // Decorated product list - `price` reflects the discount, `compareAtPrice`
  // is the original list price (so the ProductCard renders strike-through
  // automatically), and `activeOffer` carries the campaign handle so the
  // card's offer-name link points back here.
  const decorated: ProductSummary[] = React.useMemo(() => {
    return refs.map((p) => decorate(p, offer));
  }, [refs, offer]);

  // Apply sort client-side. Newest isn't meaningful here (we don't carry
  // createdAt on the populated ref), so it's an alias for "input order" -
  // which matches the admin's intentional offer product ordering. Price
  // sorts use the discounted price so the surface lines up with what the
  // shopper sees.
  const sorted: ProductSummary[] = React.useMemo(() => {
    const list = [...decorated];
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating-desc":
        list.sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0));
        break;
      case "popular":
        list.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
        break;
      // newest / relevance fall through to input order
      default:
        break;
    }
    return list;
  }, [decorated, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const setSearchParam = React.useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      router.push(`/offers/${offer.slug}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, router, offer.slug],
  );

  const onSortChange = (s: ProductSort) => setSearchParam({ sort: s, page: undefined });
  const onPageChange = (p: number) => {
    setSearchParam({ page: p });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (decorated.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-paper py-8 text-center", className)}>
        <p className="text-base font-medium">No products in this offer yet.</p>
        <p className="text-sm text-neutral-600">
          The campaign is live but the admin hasn&apos;t attached products to
          it. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <SortBar
        value={sort}
        onChange={onSortChange}
        totalCount={decorated.length}
      />
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
        {visible.map((p) => (
          <li key={p._id} className="flex flex-col">
            <ProductCard product={p} className="h-full w-full" />
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="mt-1"
        />
      ) : null}
    </div>
  );
}

/* ───────────────────── Pricing decorator ───────────────────── */

/**
 * Apply the offer to a single OfferProductRef and return the ProductSummary
 * shape the storefront card consumes. We mirror the backend's per-line math:
 *
 *  - basePrice = ref.price (the seller-listed price)
 *  - For percentage offers: savedPerUnit = floor(basePrice * pct / 100)
 *  - For fixed offers:      savedPerUnit = min(value, basePrice)
 *  - effective = max(0, basePrice - savedPerUnit)
 *  - compareAt = max(ref.compareAtPrice ?? 0, basePrice)
 *
 * The "floor" on the percentage path matches the backend's rounding so the
 * displayed offer price and the cart's actual discounted price stay in sync.
 */
function decorate(ref: OfferProductRef, offer: Offer): ProductSummary {
  const basePrice = Number(ref.price ?? 0);
  const savedPerUnit =
    offer.discountType === "percentage"
      ? Math.floor((basePrice * offer.discountValue) / 100)
      : Math.min(offer.discountValue, basePrice);
  const effective = Math.max(0, basePrice - savedPerUnit);
  const compareAt = Math.max(ref.compareAtPrice ?? 0, basePrice);

  const activeOffer: ProductActiveOffer = {
    id: offer._id,
    name: offer.name,
    slug: offer.slug,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    savedPerUnit,
  };

  return {
    _id: ref._id,
    title: ref.title,
    slug: ref.slug,
    price: effective,
    compareAtPrice: compareAt > effective ? compareAt : undefined,
    currency: offer.currency,
    // We don't get stock from the populated select set; the ProductCard's
    // "Out of stock" badge keys off `stock <= 0`. Default to 1 so we surface
    // the card normally - the shopper can verify availability on the PDP.
    stock: 1,
    images: (ref.images ?? []).map((img) => ({ url: img.url, alt: img.alt })),
    ratingAverage: ref.ratingAverage ?? 0,
    ratingCount: ref.ratingCount ?? 0,
    isFeatured: false,
    // The OfferProductRef doesn't carry category/brand summaries; leave the
    // category empty (string id placeholder) - ProductCard doesn't consume
    // this field in its render path.
    category: "",
    activeOffer,
  };
}

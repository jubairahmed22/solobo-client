"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Offer } from "@/types/offer";

/**
 * OfferTileGrid - homepage's "shop these offers" block. Renders an
 * always-4-column grid on lg+ that collapses to 2 cols on tablets and 1 col
 * on phones, mirroring the layout brief: the slider gets the marquee real
 * estate, then a tidy 4-up grid surfaces the rest of the active campaigns at
 * a glance.
 *
 * Each tile pulls its hero image from the first active banner attached to the
 * offer (admins curate the banner art in /admin/offers, so we get a guaranteed
 * crop). If an offer has no banners (rare - backend pre-filters in most
 * homepage flows) the tile falls back to a neutral placeholder so we don't
 * render a transparent slot.
 *
 * The discount chip is computed client-side from `discountType` +
 * `discountValue` so we don't depend on the backend pre-formatting it; this
 * also lets us mirror the same formatting used inside the offer detail page.
 */
export interface OfferTileGridProps {
  offers: Offer[];
  /** Section heading rendered above the grid. */
  title?: string;
  /** Optional "view all" link to the right of the heading. */
  viewAllHref?: string;
  /** Cap on rendered tiles (defaults to 8 → two rows of 4). */
  limit?: number;
  className?: string;
}

export function OfferTileGrid({
  offers,
  title = "Hot offers right now",
  viewAllHref = "/offers",
  limit = 8,
  className,
}: OfferTileGridProps) {
  const visible = offers.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <section className={cn("flex flex-col gap-3 md:gap-4", className)}>
      <header className="flex items-center justify-between gap-1">
        <h2 className="border-l-[3px] border-accent pl-3 text-sm font-black uppercase tracking-widest text-ink">
          {title}
        </h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:text-ink"
          >
            View all →
          </Link>
        ) : null}
      </header>

      <ul
        className={cn(
          "grid gap-3 md:gap-4",
          // 1 col on phones, 2 on small tablets, 4 on lg+ - matches the brief.
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {visible.map((offer) => (
          <li key={offer._id}>
            <OfferTile offer={offer} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────────────────── Single tile ───────────────────── */

function OfferTile({ offer }: { offer: Offer }) {
  const heroBanner = React.useMemo(() => {
    const active = offer.banners.filter((b) => b.isActive);
    return active.sort((a, b) => a.order - b.order)[0] ?? null;
  }, [offer.banners]);

  const discountChip =
    offer.discountType === "percentage"
      ? `${offer.discountValue}% OFF`
      : `${offer.currency} ${offer.discountValue} OFF`;

  return (
    <Link
      href={`/offers/${offer.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-paper transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {heroBanner?.image ? (
          <Image
            src={heroBanner.image}
            alt={heroBanner.title || offer.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-sm text-neutral-400">
            {offer.name}
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent shadow-sm">
          {discountChip}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 py-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-ink">
          {offer.name}
        </h3>
        {offer.description ? (
          <p className="line-clamp-2 text-xs text-neutral-500">
            {offer.description}
          </p>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-ink group-hover:underline">
          Shop now
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

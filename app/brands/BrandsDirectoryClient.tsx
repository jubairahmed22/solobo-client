"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { BrandDetail } from "@/types/catalog";

/* The Latin alphabet plus a "#" bucket for brands whose name starts with a
 * digit or symbol (numbers like "3CE", glyphs like "&Other Stories"). */
const LETTERS = [
  "#",
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
] as const;

type Letter = (typeof LETTERS)[number];

function bucketFor(name: string): Letter {
  const first = name.trim().charAt(0).toUpperCase();
  if (first >= "A" && first <= "Z") return first as Letter;
  return "#";
}

export interface BrandsDirectoryClientProps {
  /** Brands currently in view (already filtered server-side when `activeLetter` is set). */
  brands: BrandDetail[];
  /** The letter that's currently selected, or null when "All" is showing. */
  activeLetter: string | null;
  /** Letters with at least one brand in the catalogue overall (for highlight state). */
  availableLetters: string[];
}

/**
 * A-Z brand directory.
 *
 * Two responsibilities:
 *
 *  1. **URL-driven filter** - the A-Z chips are real `<Link>`s that flip the
 *     `?letter=X` query param. The page is SSR, so each chip click hits the
 *     server, lands with a pre-narrowed brand slice, and the URL is shareable.
 *     "All" rewinds to `/brands` with no query.
 *
 *  2. **Smooth scroll inside the result set** - once the page is rendered for
 *     a given filter, clicking a chip that's still in view (e.g. swapping
 *     between letters when "All" is selected) also smooth-scrolls the
 *     matching section into the viewport so the filter feels instant.
 *
 * Each brand card lands on `/all-products?brand={slug}`, which `all-products`
 * translates internally to a `brandSlug` filter so the product grid opens
 * scoped to that brand only.
 *
 * Grid sizing per the brief:
 *   xl/lg → 8 cols
 *   md    → 6 cols
 *   sm    → 4 cols
 *   xs    → 2 cols
 */
export function BrandsDirectoryClient({
  brands,
  activeLetter,
  availableLetters,
}: BrandsDirectoryClientProps) {
  const availableSet = React.useMemo(
    () => new Set(availableLetters),
    [availableLetters],
  );

  // Sort once, then bucket - keeps the in-section ordering alphabetical and
  // matches the natural reading order across each row of the grid.
  const sorted = React.useMemo(
    () =>
      [...brands].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [brands],
  );

  const buckets = React.useMemo(() => {
    const m = new Map<Letter, BrandDetail[]>();
    for (const l of LETTERS) m.set(l, []);
    for (const b of sorted) m.get(bucketFor(b.name))!.push(b);
    return m;
  }, [sorted]);

  /**
   * After SSR delivers a filtered slice, run a smooth scroll once on mount so
   * the matching letter heading lands just below the sticky navbar instead of
   * sitting flush at the top. Skipped for the "All" view - there's nothing to
   * align to in that case.
   */
  React.useEffect(() => {
    if (!activeLetter) return;
    const target = document.getElementById(
      `brand-section-${activeLetter === "#" ? "hash" : activeLetter}`,
    );
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  }, [activeLetter]);

  const hrefForLetter = (l: Letter): string =>
    l === activeLetter ? "/brands" : `/brands?letter=${encodeURIComponent(l)}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky A–Z jumper - slides under the navbar's row-2 bar when
          scrolled. Horizontally scrollable on tiny screens so all 27 chips
          remain reachable. */}
      <nav
        aria-label="Filter by letter"
        className="sticky top-[80px] z-30 -mx-3 border-y border-neutral-200 bg-paper/95 px-3 py-2 backdrop-blur md:top-[128px] md:-mx-4 md:px-4 lg:mx-0 lg:px-0"
      >
        <ul className="flex flex-wrap items-center justify-center gap-1 md:gap-1.5">
          <li>
            <Link
              href="/brands"
              scroll={false}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold uppercase tracking-wide transition-colors md:px-3 md:text-sm",
                !activeLetter
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-ink hover:text-paper",
              )}
            >
              All
            </Link>
          </li>
          {LETTERS.map((l) => {
            const enabled = availableSet.has(l);
            const isActive = l === activeLetter;
            if (!enabled && !isActive) {
              return (
                <li key={l}>
                  <span
                    aria-disabled
                    className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-xs font-semibold uppercase tracking-wide text-neutral-300 md:text-sm"
                  >
                    {l}
                  </span>
                </li>
              );
            }
            return (
              <li key={l}>
                <Link
                  href={hrefForLetter(l)}
                  scroll={false}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={
                    l === "#"
                      ? "Brands starting with a digit or symbol"
                      : `Brands starting with ${l}`
                  }
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors md:text-sm",
                    isActive
                      ? "bg-ink text-paper"
                      : "text-ink hover:bg-ink hover:text-paper",
                  )}
                >
                  {l}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
          {activeLetter
            ? `No brands starting with ${activeLetter === "#" ? "a digit or symbol" : activeLetter} yet.`
            : "No brands have been added yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {LETTERS.map((l) => {
            const group = buckets.get(l) ?? [];
            if (!group.length) return null;
            return (
              <section
                key={l}
                id={`brand-section-${l === "#" ? "hash" : l}`}
                aria-labelledby={`brand-heading-${l === "#" ? "hash" : l}`}
                className="scroll-mt-28"
              >
                <h2
                  id={`brand-heading-${l === "#" ? "hash" : l}`}
                  className="mb-2 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-ink"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-base text-paper">
                    {l}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">
                    {group.length} brand{group.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 md:gap-3 lg:grid-cols-8">
                  {group.map((b) => (
                    <BrandCard key={b._id} brand={b} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Brand card ───────────────────────────────────────────────────────── */

function BrandCard({ brand }: { brand: BrandDetail }) {
  return (
    <Link
      href={`/all-products?brand=${encodeURIComponent(brand.slug)}`}
      className="group flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-paper p-3 transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-md"
    >
      {/* Logo area - square aspect so the cards line up cleanly regardless of
          how tall or wide individual logo assets are. */}
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-50">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={`${brand.name} logo`}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 16vw, 11vw"
            className="object-contain p-2 transition-transform group-hover:scale-105"
          />
        ) : (
          <span
            aria-hidden
            className="text-2xl font-bold uppercase text-neutral-400"
          >
            {brand.name.charAt(0)}
          </span>
        )}
      </div>
      <span className="line-clamp-2 text-center text-xs font-semibold uppercase tracking-wide text-ink md:text-sm">
        {brand.name}
      </span>
    </Link>
  );
}

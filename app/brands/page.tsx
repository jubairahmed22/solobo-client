import * as React from "react";
import type { Metadata } from "next";
import axios from "axios";
import { Navbar, Footer } from "@/components/layout";
import { Breadcrumb } from "@/components/composed";
import type { ApiResponse } from "@/types/api";
import type { BrandDetail } from "@/types/catalog";
import { BrandsDirectoryClient } from "./BrandsDirectoryClient";
import { COMPANY } from "@/lib/entity/company";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: `All brands - ${COMPANY.name}`,
  description:
    `Browse every brand carried on ${COMPANY.name}. Pick a letter to jump straight to the brands you love.`,
  alternates: { canonical: `${SITE_URL}/brands` },
};

/* Letters honoured by the URL filter. Anything else is dropped on the way
 * in, so a `?letter=AB` URL falls back to the full list (mirrors the backend
 * Zod single-char guard). */
const VALID_LETTERS = new Set([
  "#",
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
]);

function normaliseLetter(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const up = v.trim().toUpperCase();
  return VALID_LETTERS.has(up) ? up : null;
}

/**
 * Fetch a slice of the brand catalogue. When `letter` is supplied the backend
 * narrows to brands whose name starts with that letter (or "#" for
 * digit/symbol openers); otherwise we pull the full active catalogue capped at
 * 500.
 *
 * Splitting the fetch this way means the SSR HTML for `?letter=A` ships with
 * only the A-bucket on first paint instead of the entire alphabet - friendlier
 * for slow connections, and the URL is the source of truth so refresh/share
 * roundtrips don't drift.
 */
async function fetchBrands(letter: string | null): Promise<BrandDetail[]> {
  try {
    const res = await axios.get<ApiResponse<BrandDetail[]>>(
      `${API_URL}/api/brands`,
      {
        params: {
          isActive: true,
          limit: 500,
          ...(letter ? { letter } : {}),
        },
        timeout: 8000,
      },
    );
    return res.data.success ? res.data.data : [];
  } catch {
    return [];
  }
}

/**
 * `availableLetters` is the set of buckets the directory should highlight as
 * active links. We always compute it from the *unfiltered* list - otherwise a
 * narrowed view (e.g. `?letter=B`) would dim every other letter and the user
 * couldn't navigate away. The Navbar dropdown uses the same fetch.
 */
async function fetchBrandLetters(): Promise<Set<string>> {
  try {
    const res = await axios.get<ApiResponse<BrandDetail[]>>(
      `${API_URL}/api/brands`,
      { params: { isActive: true, limit: 500 }, timeout: 8000 },
    );
    if (!res.data.success) return new Set();
    return new Set(
      res.data.data.map((b) => {
        const first = b.name.trim().charAt(0).toUpperCase();
        return first >= "A" && first <= "Z" ? first : "#";
      }),
    );
  } catch {
    return new Set();
  }
}

/**
 * /brands - public A–Z directory of every active brand.
 *
 * The page is fully SSR-rendered (better SEO, faster first paint) and hands
 * off to a small client component just for the smooth-scroll behaviour. The
 * filter lives in the URL (`?letter=A`) so the active letter is shareable,
 * backable, and pre-rendered on the server.
 */
export default async function BrandsPage({
  searchParams,
}: {
  searchParams?: { letter?: string | string[] };
}) {
  const letter = normaliseLetter(searchParams?.letter);

  // Fan out both fetches in parallel - the filtered list for the grid + the
  // full list once so the alphabet jumper knows which buckets exist.
  const [brands, availableLetters] = await Promise.all([
    fetchBrands(letter),
    fetchBrandLetters(),
  ]);

  // The navbar mega-menu needs the unfiltered brand list too. We could refetch
  // a third time, but reusing the brand sample we already loaded for the
  // letter highlight is plenty for the dropdown's "see top brands" affordance.
  const navBrandsSrc = letter ? await fetchBrands(null) : brands;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar
        brands={navBrandsSrc.map((b) => ({
          name: b.name,
          slug: b.slug,
          logo: b.logo,
        }))}
      />
      <main className="container-screen flex-1 py-4 md:py-6">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Brands", href: letter ? "/brands" : undefined },
            ...(letter ? [{ label: letter === "#" ? "0-9" : letter }] : []),
          ]}
        />
        <header className="mt-2 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {letter ? `Brands · ${letter === "#" ? "0-9" : letter}` : "All brands"}
          </h1>
          <p className="max-w-2xl text-sm text-neutral-600">
            {brands.length} brand{brands.length === 1 ? "" : "s"}
            {letter ? ` starting with ${letter === "#" ? "a digit or symbol" : letter}` : ` live on ${COMPANY.name}`}.
            Pick a letter to filter, or click a card to shop that brand.
          </p>
        </header>

        <div className="mt-4">
          <BrandsDirectoryClient
            brands={brands}
            activeLetter={letter}
            availableLetters={Array.from(availableLetters)}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

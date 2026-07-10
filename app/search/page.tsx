import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar, Footer } from "@/components/layout";
import { normalizeCanonical } from "@/lib/seo/canonical";
import { SearchClient } from "./SearchClient";
import { COMPANY } from "@/lib/entity/company";

export const metadata: Metadata = {
  title: `Search - ${COMPANY.name}`,
  description: `Search products across ${COMPANY.name}.`,
  // Results are noindex (thin/duplicative) but we still point the canonical at
  // the clean /search URL so any `?q=` variant collapses to one.
  robots: { index: false, follow: true },
  alternates: { canonical: normalizeCanonical("/search") },
};

interface SearchPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * /search is the canonical entry-point for site search but the actual results
 * grid lives on /all-products (filters + sort + pagination are already wired up
 * there). When the user submits a non-empty query we redirect server-side so
 * deep-links and shared URLs always resolve to the canonical results URL.
 *
 * If the query is empty we render a focused search landing page so users
 * arriving without a query (browser autocomplete, "Search" link) still
 * get a useful experience.
 */
export default function SearchPage({ searchParams }: SearchPageProps) {
  const rawQ = searchParams.q;
  const q = ((Array.isArray(rawQ) ? rawQ[0] : rawQ) ?? "").trim();

  if (q) {
    // Preserve any extra params (e.g. from a sponsored link) when forwarding.
    const next = new URLSearchParams();
    next.set("q", q);
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "q" || v === undefined) continue;
      const value = Array.isArray(v) ? v[0] : v;
      if (value) next.set(k, value);
    }
    redirect(`/all-products?${next.toString()}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-4">
        <SearchClient />
      </main>
      <Footer />
    </div>
  );
}

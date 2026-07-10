"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { Searchbar } from "@/components/composed";
import { trackSearch } from "@/lib/analytics";
import { COMPANY } from "@/lib/entity/company";

const POPULAR_QUERIES: string[] = [
  "jersey",
  "shorts",
  "running shoes",
  "track pants",
  "gym wear",
  "football kit",
  "training top",
  "sports bag",
];

const QUICK_LINKS = [
  { label: "Featured picks", href: "/all-products?sort=popular" },
  { label: "New arrivals", href: "/all-products?sort=newest" },
  { label: "Lowest price", href: "/all-products?sort=price-asc" },
  { label: "Highest rated", href: "/all-products?sort=rating-desc" },
];

/**
 * SearchClient - landing UI shown when /search is hit without a query string.
 * On submit we forward to /all-products?q=… which is the canonical results URL.
 */
export function SearchClient() {
  const router = useRouter();
  const [value, setValue] = React.useState("");

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    trackSearch(trimmed);
    router.push(`/all-products?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full border-2 border-ink">
          <Search className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Search {COMPANY.name}</h1>
        <p className="text-sm text-neutral-600">
          Find products by name, brand, or category.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2"
      >
        <Searchbar
          name="q"
          autoFocus
          value={value}
          onValueChange={setValue}
          placeholder="What are you looking for?"
          containerClassName="flex-1"
          aria-label={`Search ${COMPANY.name}`}
        />
        <Button type="submit" size="md" disabled={!value.trim()}>
          Search
        </Button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Popular searches
        </h2>
        <ul className="flex flex-wrap gap-2">
          {POPULAR_QUERIES.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => submit(q)}
                className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-ink transition-colors duration-hover ease-out hover:border-ink hover:bg-neutral-50"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Or browse the store
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-lg border border-neutral-200 bg-paper px-3 py-2.5 text-center text-sm text-ink transition-colors duration-hover ease-out hover:border-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

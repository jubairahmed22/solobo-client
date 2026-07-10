import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { CategoryTreeNode } from "@/types/catalog";

export interface CategoryTilesProps {
  categories: CategoryTreeNode[];
  limit?: number;
  className?: string;
}

/**
 * CategoryTiles - Gymshark-style collection grid. Dark cards with category
 * images; text overlaid at the bottom with an arrow CTA.
 */
export function CategoryTiles({ categories, limit = 8, className }: CategoryTilesProps) {
  const tiles = categories.slice(0, limit);
  if (tiles.length === 0) return null;

  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="border-l-[3px] border-accent pl-3 text-sm font-black uppercase tracking-widest text-ink">
          Shop by Collection
        </h2>
        <Link
          href="/all-products"
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:text-ink"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {tiles.map((c) => (
          <li key={c._id}>
            <Link
              href={`/category/${c.path}`}
              className="group relative flex aspect-square flex-col overflow-hidden bg-neutral-900"
            >
              {/* Background image */}
              {c.image ? (
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover opacity-70 transition-all duration-500 ease-out group-hover:scale-105 group-hover:opacity-50"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
                  <span className="text-3xl font-black uppercase text-neutral-600">
                    {c.name.charAt(0)}
                  </span>
                </div>
              )}

              {/* Text overlay */}
              <div className="relative mt-auto p-3">
                <span className="block text-sm font-bold uppercase tracking-wider text-paper">
                  {c.name}
                </span>
                <span className="mt-0.5 block translate-y-0 text-xs font-semibold uppercase tracking-wide text-accent transition-all duration-200 sm:translate-y-1 sm:opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                  Shop now →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

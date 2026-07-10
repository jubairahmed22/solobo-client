import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { ProductCard } from "./ProductCard";
import type { ProductSummary } from "@/types/catalog";

export interface ProductRowProps {
  title: string;
  products: ProductSummary[];
  viewAllHref?: string;
  limit?: number;
  /** Render without the white card chrome (no bleed, bg, or inner padding) so
      the row aligns flush with surrounding page content. */
  plain?: boolean;
  className?: string;
}

export function ProductRow({
  title,
  products,
  viewAllHref,
  limit = 6,
  plain = false,
  className,
}: ProductRowProps) {
  const items = products.slice(0, limit);
  if (items.length === 0) return null;

  return (
    <section
      className={cn(
        "flex flex-col gap-3",
        !plain && "-mx-4 bg-white py-4 sm:mx-0 sm:rounded-xl sm:p-4",
        className,
      )}
    >
      {/* Header: own horizontal padding on mobile, stripped on sm+ where section handles it */}
      <header
        className={cn(
          "flex items-center justify-between gap-1",
          !plain && "px-[12px] sm:px-0",
        )}
      >
        <h2 className="border-l-[3px] border-accent pl-3 text-sm font-black uppercase tracking-widest text-ink">
          {title}
        </h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:text-ink"
          >
            View all <span aria-hidden>→</span>
          </Link>
        ) : null}
      </header>

      {/*
        Mobile  : 2-col grid, 12px equal gutters on all sides (edge = gap = 12px)
        sm–lg   : 3-col grid inside the rounded card (section padding handles edges)
        lg+     : 5-col grid
      */}
      <ul
        className={cn(
          "grid grid-cols-2",
          plain ? "gap-[10px]" : "gap-[12px] px-[12px] sm:px-0",
          "sm:grid-cols-3 sm:gap-3",
          "lg:grid-cols-5 lg:gap-3",
        )}
      >
        {items.map((p) => (
          <li key={p._id} className="flex flex-col">
            <ProductCard product={p} className="h-full w-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

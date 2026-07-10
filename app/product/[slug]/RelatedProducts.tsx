"use client";

import * as React from "react";
import Link from "next/link";
import { ProductCard } from "@/components/composed";
import type { ProductSummary } from "@/types/catalog";
import { cn } from "@/lib/utils/cn";

export interface RelatedProductsProps {
  products: ProductSummary[];
  className?: string;
}

export function RelatedProducts({ products, className }: RelatedProductsProps) {
  if (products.length === 0) return null;
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="whitespace-nowrap border-l-[3px] border-accent pl-3 text-sm font-black uppercase tracking-widest text-ink">
          You might also like
        </h2>
        <Link
          href="/all-products"
          className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:text-ink"
        >
          View all →
        </Link>
      </header>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 4).map((p) => (
          <li key={p._id} className="flex flex-col">
            <ProductCard product={p} className="h-full w-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

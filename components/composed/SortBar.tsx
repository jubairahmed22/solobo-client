"use client";

import * as React from "react";
import type { ProductSort } from "@/types/catalog";
import { cn } from "@/lib/utils/cn";

const TABS: ReadonlyArray<{ label: string; value: ProductSort }> = [
  { label: "Popularity", value: "popular" },
  { label: "Price -- Low to High", value: "price-asc" },
  { label: "Price -- High to Low", value: "price-desc" },
  { label: "Newest First", value: "newest" },
];

export interface SortBarProps {
  value: ProductSort;
  onChange: (next: ProductSort) => void;
  /** Kept for API compatibility; the count is shown in the page header now. */
  totalCount?: number;
  className?: string;
  /** Prepend a "Relevance" tab (only meaningful on search results). */
  showRelevance?: boolean;
}

/**
 * Flipkart-style sort bar - a row of underlined tabs led by a "Sort By" label.
 * The active tab is highlighted in blue with an underline.
 */
export function SortBar({ value, onChange, className, showRelevance = false }: SortBarProps) {
  const tabs = showRelevance
    ? [{ label: "Relevance", value: "relevance" as ProductSort }, ...TABS]
    : TABS;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 pb-2 text-sm",
        className,
      )}
    >
      <span className="font-medium text-neutral-700">Sort By</span>
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            aria-pressed={active}
            className={cn(
              "border-b-2 py-1 transition-colors duration-hover ease-out",
              active
                ? "border-accent font-medium text-accent"
                : "border-transparent text-neutral-600 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

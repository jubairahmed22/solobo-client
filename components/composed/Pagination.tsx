"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Number of pages shown on each side of current. Default 1. */
  siblings?: number;
  className?: string;
}

/**
 * Pagination - accessible <nav> with page buttons + prev/next.
 * Renders ellipses when totalPages is large.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblings = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildRange(page, totalPages, siblings);

  const go = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== page) onPageChange(p);
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-0.5", className)}
    >
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={iconBtn}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-neutral-400" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "h-9 min-w-[36px] rounded-sm px-2 text-sm transition-colors duration-hover",
              p === page
                ? "bg-ink text-paper"
                : "text-ink hover:bg-neutral-100",
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={iconBtn}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink transition-colors duration-hover hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent";

function buildRange(page: number, total: number, siblings: number): Array<number | "…"> {
  const totalNumbers = siblings * 2 + 5; // first + last + current + 2*siblings + 2 dots
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, total);

  const showLeftDots = left > 2;
  const showRightDots = right < total - 1;

  const result: Array<number | "…"> = [1];
  if (showLeftDots) result.push("…");
  for (let i = Math.max(left, 2); i <= Math.min(right, total - 1); i++) result.push(i);
  if (showRightDots) result.push("…");
  result.push(total);
  return result;
}

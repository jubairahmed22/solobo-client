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
 * Pagination - Flowbite's joined "default" pagination: a single seamless
 * bar of 40x40 buttons sharing borders (-space-x-px + only the ends
 * rounded), page numbers navigable via aria-current, first/last-page
 * prev/next chevrons. Renders ellipses when totalPages is large.
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
    <nav aria-label="Pagination" className={cn("flex justify-center overflow-x-auto", className)}>
      <ul className="flex -space-x-px text-[14px]">
        <li>
          <button
            type="button"
            onClick={() => go(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className={cn(itemBase, "rounded-s-[8px]")}
          >
            <span className="sr-only">Previous</span>
            <ChevronLeft className="h-[16px] w-[16px]" aria-hidden />
          </button>
        </li>

        {pages.map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`}>
              <span
                className={cn(itemBase, "cursor-default text-gray-400 hover:bg-white hover:text-gray-400")}
                aria-hidden
              >
                …
              </span>
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => go(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  itemBase,
                  p === page
                    ? "border-gray-300 bg-gray-100 text-[#1A56DB] hover:text-[#1A56DB]"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                {p}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            onClick={() => go(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
            className={cn(itemBase, "rounded-e-[8px]")}
          >
            <span className="sr-only">Next</span>
            <ChevronRight className="h-[16px] w-[16px]" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  );
}

const itemBase =
  "flex h-[40px] w-[40px] items-center justify-center border border-gray-300 bg-white text-gray-500 font-medium transition-colors duration-75 hover:bg-gray-100 hover:text-gray-900 focus:outline-none disabled:pointer-events-none disabled:opacity-40";

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

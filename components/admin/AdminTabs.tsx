"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Flowbite underline tabs - the "tabs with underline" recipe:
 *
 *   <div class="text-sm font-medium text-center text-body border-b border-default">
 *     <ul class="flex flex-wrap -mb-px">
 *       <li class="me-2"><a class="inline-block p-4 border-b border-transparent
 *         rounded-t-base hover:text-fg-brand hover:border-brand">…</a></li>
 *       <li class="me-2"><a class="inline-block p-4 text-fg-brand border-b
 *         border-brand rounded-t-base active" aria-current="page">…</a></li>
 *
 * mapped to this repo (8px spacing scale → explicit px; brand → #1A56DB).
 * Rendered as buttons because the admin tab rows are client-side filters,
 * not links. The inline borderRadius keeps the rounded-t shape - the admin
 * CSS skin would otherwise round all four corners of every button, which
 * would curve the active underline.
 */

export interface AdminTabItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export function AdminTabs({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: AdminTabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "border-b border-gray-200 text-center text-[14px] font-medium text-gray-500",
        className,
      )}
    >
      {/* Horizontally scrollable on mobile (native-app filter-strip feel)
          instead of wrapping into a ragged multi-row block; wraps normally
          from sm up where there's room. Scrollbar hidden but still
          swipeable/scrollable. */}
      <ul
        className="-mb-px flex flex-nowrap gap-[4px] overflow-x-auto sm:flex-wrap sm:gap-0 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <li key={item.value} className="shrink-0 sm:me-[8px] sm:last:me-0">
              <button
                type="button"
                onClick={() => !item.disabled && onChange(item.value)}
                disabled={item.disabled}
                aria-current={active ? "page" : undefined}
                style={{ borderRadius: "8px 8px 0 0" }}
                className={cn(
                  "inline-block whitespace-nowrap border-b p-[16px] transition-colors duration-75",
                  item.disabled
                    ? "cursor-not-allowed border-transparent text-gray-400"
                    : active
                      ? "border-[#1A56DB] text-[#1A56DB]"
                      : "border-transparent hover:border-[#1A56DB] hover:text-[#1A56DB]",
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

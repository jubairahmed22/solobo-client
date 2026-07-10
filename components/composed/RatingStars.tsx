"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface RatingStarsProps {
  /** 0–5, fractional allowed (e.g. 4.3). */
  value: number;
  /** When provided, becomes interactive - calls onChange with 1–5. */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  /** Total reviews count to display next to stars. */
  count?: number;
  className?: string;
}

const SIZE_MAP = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
} as const;

export function RatingStars({
  value,
  onChange,
  size = "md",
  count,
  className,
}: RatingStarsProps) {
  const interactive = typeof onChange === "function";
  const clamped = Math.max(0, Math.min(5, value));
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <div
        className="inline-flex items-center"
        role={interactive ? "radiogroup" : "img"}
        aria-label={`Rated ${clamped.toFixed(1)} out of 5`}
      >
        {stars.map((star) => {
          const fill = Math.max(0, Math.min(1, clamped - (star - 1)));
          return (
            <button
              key={star}
              type="button"
              role={interactive ? "radio" : undefined}
              aria-checked={interactive ? clamped >= star : undefined}
              tabIndex={interactive ? 0 : -1}
              disabled={!interactive}
              onClick={() => interactive && onChange?.(star)}
              className={cn(
                "relative inline-flex shrink-0 items-center justify-center",
                interactive && "cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                !interactive && "cursor-default",
              )}
            >
              {/* empty backdrop */}
              <Star className={cn(SIZE_MAP[size], "text-neutral-300")} aria-hidden />
              {/* filled overlay clipped to fractional fill */}
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
                aria-hidden
              >
                <Star className={cn(SIZE_MAP[size], "fill-ink text-ink")} />
              </span>
            </button>
          );
        })}
      </div>
      {typeof count === "number" ? (
        <span className="text-xs text-neutral-500">({count.toLocaleString("en-US")})</span>
      ) : null}
    </div>
  );
}

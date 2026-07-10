"use client";

import * as React from "react";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";

const DEFAULT_ITEMS = [
  "30-day free returns - no questions asked",
  "New arrivals every week",
  "100% authentic products",
  "Performance gear for every level",
  "Cash on delivery available",
];

export function FooterTicker() {
  const { data } = usePublicSiteSettings();

  const items: string[] = [];

  // Auto-inject free delivery text driven by the delivery threshold setting
  const threshold = data?.delivery?.freeShippingThreshold ?? 0;
  if (threshold > 0) {
    items.push(
      `Free nationwide delivery on orders over Tk ${threshold.toLocaleString("en-IN")}`,
    );
  }

  const editableItems =
    data?.announcementBar?.items && data.announcementBar.items.length > 0
      ? data.announcementBar.items
      : DEFAULT_ITEMS;
  items.push(...editableItems);

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden bg-accent py-2">
      <div className="animate-marquee flex w-max items-center gap-10 whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <React.Fragment key={i}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-paper">
              {item}
            </span>
            <span className="text-paper/50 text-xs" aria-hidden>
              ✦
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

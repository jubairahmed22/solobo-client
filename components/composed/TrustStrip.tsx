import * as React from "react";
import { Truck, RotateCcw, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TrustStripProps {
  className?: string;
}

const ITEMS = [
  {
    Icon: Truck,
    title: "Fast Nationwide Delivery",
    body: "Same-day dispatch on orders before 2pm. Tracked every step.",
  },
  {
    Icon: RotateCcw,
    title: "30-Day Free Returns",
    body: "Not the right fit? Send it back free, no questions asked.",
  },
  {
    Icon: Shield,
    title: "Authentic Products",
    body: "100% genuine - every item verified before it ships.",
  },
  {
    Icon: Zap,
    title: "Performance Guarantee",
    body: "Built to move with you. Quality engineered for athletes.",
  },
];

export function TrustStrip({ className }: TrustStripProps) {
  return (
    <section
      aria-label="Why shop with us"
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 shadow-sm",
        "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {ITEMS.map(({ Icon, title, body }) => (
        <div
          key={title}
          className="group flex flex-col items-center gap-3 bg-paper px-5 py-7 text-center transition-colors hover:bg-neutral-50"
        >
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink ring-4 ring-accent/10 transition-all duration-200 group-hover:scale-110 group-hover:ring-accent/20">
            <Icon className="h-6 w-6 text-accent" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{title}</h3>
            <p className="max-w-[26ch] text-xs leading-relaxed text-neutral-500">{body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

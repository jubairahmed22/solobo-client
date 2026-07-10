import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface DetailsRow {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface DetailsCardProps
  extends Omit<React.HTMLAttributes<HTMLDListElement>, "title"> {
  title?: React.ReactNode;
  rows: DetailsRow[];
  /** Render as horizontal label-value table on >=md screens. */
  horizontal?: boolean;
}

/**
 * DetailsCard - render a label/value list inside a bordered card.
 * Used on order summary, profile info, invoice header.
 */
export function DetailsCard({ title, rows, horizontal = true, className, ...props }: DetailsCardProps) {
  return (
    <section className={cn("rounded-md border border-neutral-200 bg-paper", className)}>
      {title ? (
        <header className="border-b border-neutral-200 px-3 py-2">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
        </header>
      ) : null}
      <dl className="divide-y divide-neutral-100" {...props}>
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "px-3 py-2 text-sm",
              horizontal && "md:grid md:grid-cols-3 md:gap-2",
            )}
          >
            <dt className="text-neutral-500">{row.label}</dt>
            <dd className={cn("mt-0.5 text-ink md:col-span-2 md:mt-0")}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

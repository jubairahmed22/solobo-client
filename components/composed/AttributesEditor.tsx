"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/**
 * AttributesEditor - a flexible key/value spec editor for the product form.
 *
 * Products carry a free-form `attributes` map (Color, Size, Weight, Material, …)
 * that renders in the server-side Specifications block on the PDP. Sellers pick
 * from common industry-standard names (autocomplete via <datalist>) OR type
 * anything custom - the keys aren't an enum, so the form never blocks a niche
 * attribute. Output is a flat `Record<string,string>` (see draftsToAttributes).
 */

export interface AttributeDraft {
  /** Stable client key so React rows survive edits/reorders. */
  _key: string;
  name: string;
  value: string;
}

export interface AttributesEditorProps {
  value: AttributeDraft[];
  onChange: (next: AttributeDraft[]) => void;
  /** Cap to keep the spec list sane. */
  max?: number;
  className?: string;
}

/**
 * Common ecommerce / beauty attribute names offered as autocomplete. Not a
 * whitelist - purely suggestions; the admin can type any key.
 */
const SUGGESTED_ATTRIBUTES = [
  "Color",
  "Size",
  "Weight",
  "Material",
  "Fit",
  "Gender",
  "Sport",
  "Technology",
  "Fabric",
  "Sleeve Length",
  "Collar Type",
  "Closure",
  "Pack Size",
  "Country of Origin",
  "Care Instructions",
  "Warranty",
];

let counter = 0;
function nextKey(): string {
  counter += 1;
  return `attr-${counter}`;
}

export function emptyAttribute(): AttributeDraft {
  return { _key: nextKey(), name: "", value: "" };
}

/** Hydrate the editor from a saved attributes map (edit form). */
export function attributesToDrafts(attrs?: Record<string, string> | null): AttributeDraft[] {
  if (!attrs) return [];
  return Object.entries(attrs).map(([name, value]) => ({ _key: nextKey(), name, value }));
}

/**
 * Collapse drafts into the wire `Record<string,string>`. Incomplete rows
 * (missing name or value) are dropped; on a duplicate key the last row wins.
 * Returns undefined when empty so the backend default isn't clobbered.
 */
export function draftsToAttributes(drafts: AttributeDraft[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const d of drafts) {
    const name = d.name.trim();
    const value = d.value.trim();
    if (name && value) out[name] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function AttributesEditor({ value, onChange, max = 30, className }: AttributesEditorProps) {
  const datalistId = React.useId();

  const update = (key: string, patch: Partial<AttributeDraft>) =>
    onChange(value.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => onChange(value.filter((r) => r._key !== key));
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, emptyAttribute()]);
  };

  // Flag duplicate (case-insensitive) names so the seller notices one will win.
  const nameCounts = new Map<string, number>();
  for (const r of value) {
    const n = r.name.trim().toLowerCase();
    if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <datalist id={datalistId}>
        {SUGGESTED_ATTRIBUTES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {value.length === 0 ? (
        <p className="text-[11px] text-neutral-500">
          No attributes yet. Add specs like Color, Size, or Weight - shoppers see these in the
          product Specifications, and they help search + AI engines understand the item.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {/* Column header on sm+ for clarity. */}
          <li className="hidden gap-1 px-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500 sm:flex">
            <span className="w-2/5">Attribute</span>
            <span className="flex-1">Value</span>
            <span className="w-5" aria-hidden />
          </li>
          {value.map((row) => {
            const dupe = (nameCounts.get(row.name.trim().toLowerCase()) ?? 0) > 1;
            return (
              <li key={row._key} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-1">
                <div className="sm:w-2/5">
                  <Input
                    list={datalistId}
                    placeholder="e.g. Color"
                    aria-label="Attribute name"
                    value={row.name}
                    onChange={(e) => update(row._key, { name: e.target.value })}
                    invalid={dupe}
                  />
                  {dupe ? (
                    <span className="text-[11px] text-neutral-500">Duplicate - last value wins</span>
                  ) : null}
                </div>
                <div className="flex flex-1 items-start gap-1">
                  <Input
                    placeholder="e.g. Midnight Black"
                    aria-label="Attribute value"
                    value={row.value}
                    onChange={(e) => update(row._key, { value: e.target.value })}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => remove(row._key)}
                    aria-label="Remove attribute"
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-100 hover:text-ink"
                  >
                    <Trash2 className="h-2 w-2" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={add}
          disabled={value.length >= max}
        >
          <Plus className="h-2 w-2" aria-hidden />
          <span className="ml-0.5">Add attribute</span>
        </Button>
        <span className="text-[11px] text-neutral-500">
          {value.length} / {max}
        </span>
      </div>
    </div>
  );
}

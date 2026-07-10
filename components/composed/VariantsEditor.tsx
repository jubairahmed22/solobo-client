"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { SellerProductVariantInput } from "@/types/seller";

/* ──────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────── */

/** One selectable attribute type (e.g. "Size") and its set of values (e.g. ["S","M","L"]). */
export interface OptionDef {
  _key: string;
  name: string;
  values: string[];
}

/** A single generated variant row. `options` is derived from OptionDef combinations. */
export interface VariantDraft {
  _key: string;
  _id?: string;
  sku: string;
  options: Record<string, string>;
  price: string;
  compareAtPrice: string;
  stock: string;
  isActive: boolean;
}

export interface VariantsEditorProps {
  options: OptionDef[];
  onOptionsChange: (next: OptionDef[]) => void;
  variants: VariantDraft[];
  onVariantsChange: (next: VariantDraft[]) => void;
  currency?: string;
  max?: number;
  className?: string;
}

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

let draftCounter = 0;
function nextKey() {
  draftCounter += 1;
  return `v-${draftCounter}`;
}

function nextOptionKey() {
  draftCounter += 1;
  return `o-${draftCounter}`;
}

/** Convert a server variant into a VariantDraft. */
export function variantToDraft(v: {
  _id?: string;
  sku: string;
  options?: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  stock: number;
  isActive?: boolean;
}): VariantDraft {
  return {
    _key: nextKey(),
    _id: v._id,
    sku: v.sku,
    options: v.options ?? {},
    price: v.price !== undefined ? String(v.price) : "",
    compareAtPrice: v.compareAtPrice !== undefined ? String(v.compareAtPrice) : "",
    stock: String(v.stock ?? 0),
    isActive: v.isActive ?? true,
  };
}

/** Extract OptionDef[] from existing VariantDraft[] (for edit form initialisation). */
export function extractOptionDefs(drafts: VariantDraft[]): OptionDef[] {
  const map = new Map<string, string[]>();
  for (const d of drafts) {
    for (const [key, val] of Object.entries(d.options)) {
      if (!map.has(key)) map.set(key, []);
      if (!map.get(key)!.includes(val)) map.get(key)!.push(val);
    }
  }
  return Array.from(map.entries()).map(([name, values]) => ({
    _key: nextOptionKey(),
    name,
    values,
  }));
}

/** Convert VariantDraft[] to the wire shape the backend expects. */
export function draftsToVariantInputs(drafts: VariantDraft[]): SellerProductVariantInput[] {
  return drafts.map((d) => {
    const priceNum = d.price.trim() === "" ? undefined : Number(d.price);
    const capNum = d.compareAtPrice.trim() === "" ? undefined : Number(d.compareAtPrice);
    const stockNum = Number(d.stock);
    const stock = Number.isFinite(stockNum) ? Math.max(0, Math.floor(stockNum)) : 0;
    return {
      sku: d.sku.trim().toUpperCase(),
      options: d.options,
      price: Number.isFinite(priceNum as number) ? priceNum : undefined,
      compareAtPrice:
        Number.isFinite(capNum as number) && (capNum as number) > 0 ? capNum : undefined,
      stock,
      isActive: d.isActive,
    };
  });
}

/** Generate every combination of option values. */
function generateCombinations(options: OptionDef[]): Record<string, string>[] {
  const active = options.filter(
    (o) => o.name.trim() && o.values.some((v) => v.trim()),
  );
  if (!active.length) return [];
  let combos: Record<string, string>[] = [{}];
  for (const opt of active) {
    const vals = opt.values.filter((v) => v.trim());
    combos = combos.flatMap((c) =>
      vals.map((v) => ({ ...c, [opt.name.trim()]: v.trim() })),
    );
  }
  return combos;
}

/** Return true when `draft.options` exactly matches `combo`. */
function matchesCombo(draft: VariantDraft, combo: Record<string, string>): boolean {
  const dk = Object.keys(draft.options);
  const ck = Object.keys(combo);
  if (dk.length !== ck.length) return false;
  return ck.every((k) => draft.options[k] === combo[k]);
}

/**
 * Reconcile the variants list against the current option definitions.
 * Existing rows whose combo still exists are preserved (keeping SKU/price/stock).
 * New combos get an empty draft. Combos that no longer exist are dropped.
 */
function reconcileVariants(
  options: OptionDef[],
  existing: VariantDraft[],
): VariantDraft[] {
  const combos = generateCombinations(options);
  if (!combos.length) return [];
  return combos.map((combo) => {
    const found = existing.find((v) => matchesCombo(v, combo));
    return (
      found ?? {
        _key: nextKey(),
        sku: "",
        options: combo,
        price: "",
        compareAtPrice: "",
        stock: "0",
        isActive: true,
      }
    );
  });
}

function variantLabel(options: Record<string, string>): string {
  return Object.values(options).join(" / ") || "-";
}

/* ──────────────────────────────────────────────────────────
   Tag chip input (for option values)
   ────────────────────────────────────────────────────────── */

function TagInput({
  values,
  onChange,
  placeholder = "Add value…",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commit = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-[36px] cursor-text flex-wrap items-center gap-1 rounded-sm border border-neutral-300 bg-paper px-2 py-1 focus-within:border-ink focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-1"
    >
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-ink"
        >
          {v}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(values.filter((x) => x !== v));
            }}
            className="text-neutral-400 hover:text-ink"
          >
            <X className="h-2.5 w-2.5" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        placeholder={values.length === 0 ? placeholder : ""}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Backspace" && !input && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        className="min-w-[80px] flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────────────────── */

export function VariantsEditor({
  options,
  onOptionsChange,
  variants,
  onVariantsChange,
  currency = "BDT",
  max = 100,
  className,
}: VariantsEditorProps) {
  /* ── Option CRUD ── */

  function addOption() {
    onOptionsChange([
      ...options,
      { _key: nextOptionKey(), name: "", values: [] },
    ]);
  }

  function removeOption(key: string) {
    const next = options.filter((o) => o._key !== key);
    onOptionsChange(next);
    onVariantsChange(reconcileVariants(next, variants));
  }

  function patchOption(key: string, partial: Partial<OptionDef>) {
    const next = options.map((o) => (o._key === key ? { ...o, ...partial } : o));
    onOptionsChange(next);
    onVariantsChange(reconcileVariants(next, variants));
  }

  /* ── Variant row CRUD ── */

  function patchVariant(idx: number, partial: Partial<VariantDraft>) {
    onVariantsChange(
      variants.map((v, i) => (i === idx ? { ...v, ...partial } : v)),
    );
  }

  function removeVariant(idx: number) {
    onVariantsChange(variants.filter((_, i) => i !== idx));
  }

  const totalStock = variants.reduce(
    (s, v) => s + (Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0),
    0,
  );

  const hasOptions = options.some(
    (o) => o.name.trim() && o.values.some((v) => v.trim()),
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ── Option definitions ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-neutral-700">
            Options
          </p>
          <span className="text-[11px] text-neutral-400">
            e.g. Size, Color, Material
          </span>
        </div>

        {options.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center">
            <p className="text-sm text-neutral-500">No options defined yet.</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Add an option (Size, Color…) and its values to auto-generate variant rows.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <div
                key={opt._key}
                className="grid grid-cols-[140px_1fr_28px] items-start gap-2"
              >
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Option name
                  </label>
                  <Input
                    type="text"
                    value={opt.name}
                    onChange={(e) => patchOption(opt._key, { name: e.target.value })}
                    placeholder="e.g. Size"
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Values - type and press Enter or comma
                  </label>
                  <TagInput
                    values={opt.values}
                    onChange={(vals) => patchOption(opt._key, { values: vals })}
                    placeholder="S, M, L, XL…"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeOption(opt._key)}
                  className="mt-5 flex h-9 w-7 items-center justify-center text-neutral-400 hover:text-red-500"
                  aria-label="Remove option"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addOption}
          className="self-start"
        >
          <Plus className="h-2 w-2" aria-hidden />
          <span className="ml-0.5">Add option</span>
        </Button>
      </div>

      {/* ── Generated variants table ── */}
      {hasOptions ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-700">
              Variants
              <span className="ml-1.5 font-normal text-neutral-400">
                ({variants.length} generated · {totalStock} total stock)
              </span>
            </p>
          </div>

          {variants.length === 0 ? (
            <p className="text-[11px] text-neutral-400">
              No combinations yet - add values to your options above.
            </p>
          ) : variants.length > max ? (
            <p className="text-[11px] text-red-600">
              Too many combinations ({variants.length}). Reduce option values to stay under {max}.
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[1.2fr_0.9fr_88px_88px_64px_44px_28px] items-center gap-1.5 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Variant</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">SKU</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Price ({currency})</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Was ({currency})</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Stock</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">On</span>
                <span />
              </div>

              <ul className="flex flex-col gap-0.5">
                {variants.map((row, i) => {
                  const p = row.price.trim() === "" ? NaN : Number(row.price);
                  const cap = row.compareAtPrice.trim() === "" ? NaN : Number(row.compareAtPrice);
                  const onSale = Number.isFinite(p) && Number.isFinite(cap) && cap > p;

                  return (
                    <li
                      key={row._key}
                      className={cn(
                        "grid grid-cols-[1.2fr_0.9fr_88px_88px_64px_44px_28px] items-center gap-1.5 rounded-sm border bg-paper px-1.5 py-1 transition-colors",
                        row.isActive
                          ? "border-neutral-200 hover:border-neutral-300"
                          : "border-neutral-100 bg-neutral-50 opacity-60",
                      )}
                    >
                      {/* Variant label */}
                      <span className="truncate text-sm font-medium text-ink">
                        {variantLabel(row.options)}
                      </span>

                      {/* SKU */}
                      <Input
                        type="text"
                        value={row.sku}
                        onChange={(e) => patchVariant(i, { sku: e.target.value })}
                        placeholder="SKU"
                        aria-label="SKU"
                        className="font-mono text-xs uppercase"
                      />

                      {/* Sale price */}
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price}
                          onChange={(e) => patchVariant(i, { price: e.target.value })}
                          placeholder="Base"
                          aria-label="Variant price"
                          className="tabular-nums"
                        />
                        {onSale && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent"
                            aria-hidden
                          />
                        )}
                      </div>

                      {/* Compare-at / Was */}
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.compareAtPrice}
                        onChange={(e) => patchVariant(i, { compareAtPrice: e.target.value })}
                        placeholder="-"
                        aria-label="Original price (was)"
                        className={cn("tabular-nums", onSale && "text-neutral-400")}
                      />

                      {/* Stock */}
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={row.stock}
                        onChange={(e) => patchVariant(i, { stock: e.target.value })}
                        aria-label="Stock"
                        className="tabular-nums"
                      />

                      {/* Active toggle */}
                      <label className="flex cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(e) => patchVariant(i, { isActive: e.target.checked })}
                          aria-label="Active"
                          className="h-3.5 w-3.5 rounded-sm border-neutral-300 text-ink"
                        />
                      </label>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        aria-label="Remove variant"
                        className="flex items-center justify-center text-neutral-300 hover:text-red-500"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="text-[11px] text-neutral-400">
                Leave <strong>Price</strong> blank to inherit the base product price. Set{" "}
                <strong>Was</strong> above Price to show a strikethrough sale price per variant.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

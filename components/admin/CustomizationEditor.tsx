"use client";

import * as React from "react";
import { Check, Maximize2, X } from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import {
  allowedPatches,
  collectCategorySlugs,
  matchAssignment,
} from "@/lib/utils/customization";
import type {
  CustomizationAssignment,
  CustomizationPatch,
  PublicCustomizationConfig,
} from "@/types/customization";

/**
 * Shared personalisation editor for the admin surfaces (POS configurator,
 * order add-item picker, order line editing). Mirrors the storefront PDP's
 * option encoding exactly:
 *
 *   Print   - "Both" | "Front" | "Back" (Front prints the number only)
 *   Name    - printed name
 *   Number  - printed number
 *   Patches - comma-separated patch names
 *
 * The server re-prices everything authoritatively via priceCustomizations,
 * so the add-on preview here only has to agree with the public config.
 */

export type PrintPlacement = "Both" | "Front" | "Back";

/** Option keys reserved for personalisation - never variant axes. */
export const CUSTOMIZATION_KEYS = ["Name", "Number", "Patches", "Print"] as const;

export function isCustomizationKey(key: string): boolean {
  return (CUSTOMIZATION_KEYS as readonly string[]).includes(key);
}

export interface CustomizationDraft {
  placement: PrintPlacement;
  name: string;
  number: string;
  /** Selected patch NAMES (the option encoding is name-based). */
  patches: string[];
}

export interface CustomizationAddOn {
  label: string;
  amount: number;
}

export function draftFromOptions(
  options: Record<string, string> | undefined,
): CustomizationDraft {
  const print = options?.["Print"];
  return {
    placement: print === "Front" || print === "Back" ? print : "Both",
    name: options?.["Name"] ?? "",
    number: options?.["Number"] ?? "",
    patches: (options?.["Patches"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** Resolve the assignment for a product the same way the server does. */
export function useCustomizationAssignment(
  config: PublicCustomizationConfig | null | undefined,
  product:
    | { _id: string; category?: unknown; categories?: unknown[] }
    | null
    | undefined,
): {
  assignment: CustomizationAssignment | null;
  patchChoices: CustomizationPatch[];
  allowName: boolean;
  allowNumber: boolean;
} {
  const assignment = React.useMemo(() => {
    if (!product || !config) return null;
    return matchAssignment(
      config.assignments,
      product._id,
      collectCategorySlugs(product as Parameters<typeof collectCategorySlugs>[0]),
    );
  }, [product, config]);
  const patchChoices = React.useMemo(
    () => allowedPatches(config, assignment),
    [config, assignment],
  );
  return {
    assignment,
    patchChoices,
    allowName: assignment ? (assignment.allowName ?? true) : false,
    allowNumber: assignment ? (assignment.allowNumber ?? true) : false,
  };
}

/**
 * The personalisation option keys for a draft - merge these over the
 * variant axes when composing a line's options. Front placement drops the
 * name (number-only print).
 */
export function customizationOptions(
  draft: CustomizationDraft,
  allowName: boolean,
  allowNumber: boolean,
  patchChoices: CustomizationPatch[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const nameAllowed = allowName && draft.placement !== "Front";
  if (nameAllowed && draft.name.trim()) out["Name"] = draft.name.trim();
  if (allowNumber && draft.number.trim()) out["Number"] = draft.number.trim();
  if (out["Name"] || out["Number"]) out["Print"] = draft.placement;
  const names = patchChoices
    .filter((p) => draft.patches.includes(p.name))
    .map((p) => p.name);
  if (names.length > 0) out["Patches"] = names.join(", ");
  return out;
}

/** Per-unit add-on preview for a draft - matches the server's labels. */
export function customizationAddOns(
  draft: CustomizationDraft,
  config: PublicCustomizationConfig | null | undefined,
  allowName: boolean,
  allowNumber: boolean,
  patchChoices: CustomizationPatch[],
): CustomizationAddOn[] {
  const list: CustomizationAddOn[] = [];
  const hasName =
    allowName && draft.placement !== "Front" && Boolean(draft.name.trim());
  const hasNumber = allowNumber && Boolean(draft.number.trim());
  const printFee = config?.addOnPrices.name ?? 0;
  if ((hasName || hasNumber) && printFee > 0) {
    list.push({
      label:
        hasName && hasNumber
          ? "Name & number print"
          : hasName
            ? "Name print"
            : "Number print",
      amount: printFee,
    });
  }
  for (const p of patchChoices) {
    if (draft.patches.includes(p.name)) {
      list.push({ label: `Patch: ${p.name}`, amount: p.price });
    }
  }
  return list;
}

/* ───────────────────── Fields ───────────────────── */

export interface CustomizationFieldsProps {
  draft: CustomizationDraft;
  onChange: (draft: CustomizationDraft) => void;
  config: PublicCustomizationConfig | null | undefined;
  allowName: boolean;
  allowNumber: boolean;
  patchChoices: CustomizationPatch[];
  currency?: string;
}

/**
 * Flowbite-styled personalisation fields: placement segmented control
 * (Both / Front / Back - Front hides the name), name + number inputs, and
 * the patch chips with prices.
 */
export function CustomizationFields({
  draft,
  onChange,
  config,
  allowName,
  allowNumber,
  patchChoices,
  currency = "BDT",
}: CustomizationFieldsProps) {
  const printFee = config?.addOnPrices.name ?? 0;
  const nameVisible = allowName && draft.placement !== "Front";
  const setPlacement = (placement: PrintPlacement) =>
    onChange(
      placement === "Front"
        ? { ...draft, placement, name: "" }
        : { ...draft, placement },
    );
  const togglePatch = (name: string) =>
    onChange({
      ...draft,
      patches: draft.patches.includes(name)
        ? draft.patches.filter((n) => n !== name)
        : [...draft.patches, name],
    });

  const addOns = customizationAddOns(draft, config, allowName, allowNumber, patchChoices);
  const addOnTotal = addOns.reduce((s, a) => s + a.amount, 0);

  /* Tapping a patch's zoom affordance opens a large preview, same as the
   * storefront PDP, so the cashier can inspect the art before adding it. */
  const [previewPatch, setPreviewPatch] = React.useState<CustomizationPatch | null>(null);

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Placement - only meaningful when both name and number exist */}
      {allowName && allowNumber ? (
        <div className="flex flex-col gap-[6px]">
          <span className="text-[13px] font-medium text-gray-900">Select</span>
          <div className="flex gap-[8px]" role="radiogroup" aria-label="Print placement">
            {(["Both", "Front", "Back"] as const).map((p) => {
              const active = draft.placement === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPlacement(p)}
                  className={cn(
                    "rounded-[8px] border px-[16px] py-[6px] text-[13px] font-medium transition duration-75",
                    active
                      ? "border-[#1A56DB] bg-[#1A56DB] text-white"
                      : "border-gray-300 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
          {draft.placement === "Front" ? (
            <p className="text-[12px] text-gray-400">Front print carries the number only.</p>
          ) : null}
        </div>
      ) : null}

      {/* Name / number */}
      {nameVisible || allowNumber ? (
        <div className="flex flex-wrap gap-[16px]">
          {nameVisible ? (
            <label className="flex flex-col gap-[6px] text-[13px] font-medium text-gray-900">
              Name
              <Input
                value={draft.name}
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
                placeholder="e.g. RONALDO"
                maxLength={20}
                className="w-44"
              />
            </label>
          ) : null}
          {allowNumber ? (
            <label className="flex flex-col gap-[6px] text-[13px] font-medium text-gray-900">
              Number
              <Input
                value={draft.number}
                onChange={(e) =>
                  onChange({ ...draft, number: e.target.value.replace(/[^0-9]/g, "") })
                }
                placeholder="7"
                maxLength={3}
                className="w-24"
              />
            </label>
          ) : null}
          {printFee > 0 ? (
            <span className="self-end pb-[10px] text-[12px] text-gray-400">
              name/number +{formatPrice(printFee, currency)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Patches - image grid with a zoom-to-preview affordance, matching
          the storefront PDP so staff can see the art before adding it. */}
      {patchChoices.length > 0 ? (
        <div className="flex flex-col gap-[8px]">
          <span className="text-[13px] font-medium text-gray-900">Patch</span>
          <div className="grid grid-cols-3 gap-[8px] sm:grid-cols-4 md:grid-cols-5">
            {patchChoices.map((p) => {
              const checked = draft.patches.includes(p.name);
              return (
                <div key={p._id ?? p.name} className="relative">
                  <button
                    type="button"
                    onClick={() => togglePatch(p.name)}
                    aria-pressed={checked}
                    className={cn(
                      "flex w-full flex-col items-center gap-[6px] rounded-[8px] border p-[10px] text-center transition duration-75",
                      checked
                        ? "border-[#1A56DB] bg-blue-50"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    )}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-[48px] w-[48px] rounded-full border border-gray-200 bg-white object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-[48px] w-[48px] items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: p.color || "#525252" }}
                      >
                        {p.abbreviation || p.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="line-clamp-2 text-[12px] font-medium leading-tight text-gray-900">
                      {p.name}
                    </span>
                    <span className="text-[12px] font-semibold text-[#1A56DB]">
                      +{formatPrice(p.price, currency)}
                    </span>
                    {checked ? (
                      <span className="absolute left-[6px] top-[6px] flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#1A56DB] text-white">
                        <Check className="h-[10px] w-[10px]" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPatch(p)}
                    aria-label={`Preview ${p.name}`}
                    title="View larger"
                    className="absolute right-[6px] top-[6px] flex h-[20px] w-[20px] items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-sm transition-colors hover:text-gray-900"
                  >
                    <Maximize2 className="h-[10px] w-[10px]" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Patch preview modal */}
      {previewPatch ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-[16px]"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewPatch.name} preview`}
          onClick={() => setPreviewPatch(null)}
        >
          <div
            className="w-full max-w-[300px] rounded-xl bg-white p-[16px] text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPatch(null)}
                aria-label="Close preview"
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-[16px] w-[16px]" aria-hidden />
              </button>
            </div>
            {previewPatch.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewPatch.imageUrl}
                alt={previewPatch.name}
                className="mx-auto h-[180px] w-[180px] rounded-full object-cover shadow-md"
              />
            ) : (
              <div
                className="mx-auto flex h-[180px] w-[180px] items-center justify-center rounded-full text-[28px] font-bold text-white shadow-md"
                style={{ backgroundColor: previewPatch.color || "#525252" }}
              >
                {previewPatch.abbreviation || previewPatch.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="mt-[12px] text-[14px] font-semibold text-gray-900">{previewPatch.name}</p>
            <p className="mt-[2px] text-[14px] font-bold text-[#1A56DB]">
              +{formatPrice(previewPatch.price, currency)}
            </p>
            <button
              type="button"
              onClick={() => {
                togglePatch(previewPatch.name);
                setPreviewPatch(null);
              }}
              className={cn(
                "mt-[12px] w-full rounded-[8px] py-[10px] text-[13px] font-semibold transition duration-75",
                draft.patches.includes(previewPatch.name)
                  ? "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100"
                  : "bg-[#1A56DB] text-white hover:bg-[#1E429F]",
              )}
            >
              {draft.patches.includes(previewPatch.name) ? "Remove patch" : "Add patch"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Add-on summary */}
      {addOns.length > 0 ? (
        <p className="text-[13px] text-gray-500">
          Add-ons:{" "}
          {addOns.map((a) => `${a.label} (+${formatPrice(a.amount, currency)})`).join(" · ")}{" "}
          <span className="font-semibold text-gray-900">
            = +{formatPrice(addOnTotal, currency)} per unit
          </span>
        </p>
      ) : null}
    </div>
  );
}

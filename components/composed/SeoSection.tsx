"use client";

import * as React from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { COMPANY } from "@/lib/entity/company";

/**
 * SEO / meta-tags editor shared by the admin product create + edit forms.
 *
 * Surfaces the backend's `metaTitle` (≤160) and `metaDescription` (≤320)
 * fields with live character counters and a Google-style SERP preview so the
 * admin can tune exactly how the product shows up in search results. When a
 * meta field is left blank the storefront falls back to the product title /
 * short description - the preview mirrors that fallback live.
 *
 * Typed loosely against `react-hook-form` because the two host forms have
 * different value shapes; both register `metaTitle` + `metaDescription`.
 */
export interface SeoSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  metaTitle: string;
  metaDescription: string;
  /** Product title - used as the SERP/title fallback when metaTitle is blank. */
  titleFallback?: string;
  /** Short description - used as the SERP fallback when metaDescription is blank. */
  descriptionFallback?: string;
  /** Slug (or "auto-generated") rendered into the preview URL line. */
  slug?: string;
}

const TITLE_MAX = 160;
/** Google typically truncates titles past ~60 chars - warn before the hard cap. */
const TITLE_IDEAL = 60;
const DESC_MAX = 320;
/** Google typically truncates descriptions past ~160 chars. */
const DESC_IDEAL = 160;

export function SeoSection({
  register,
  errors,
  metaTitle,
  metaDescription,
  titleFallback,
  descriptionFallback,
  slug,
}: SeoSectionProps) {
  const titleLen = metaTitle?.length ?? 0;
  const descLen = metaDescription?.length ?? 0;

  const previewTitle = (metaTitle?.trim() || titleFallback?.trim() || "Product title");
  const previewDesc =
    metaDescription?.trim() ||
    descriptionFallback?.trim() ||
    "Add a meta description so search engines show a compelling summary of this product.";
  const previewSlug = slug && slug !== "auto-generated" ? slug : "product-name";

  const titleErr = (errors.metaTitle?.message as string | undefined) ?? undefined;
  const descErr = (errors.metaDescription?.message as string | undefined) ?? undefined;

  return (
    <section className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-paper p-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-ink">SEO &amp; meta tags</h2>
        <span className="text-[11px] text-neutral-500">
          How this product appears in Google &amp; social shares
        </span>
      </div>

      {/* Google-style SERP preview */}
      <div className="rounded-sm border border-neutral-200 bg-neutral-50 p-1.5">
        <p className="truncate text-[12px] text-emerald-700">
          solobo.com › product › {previewSlug}
        </p>
        <p className="truncate text-[16px] leading-snug text-[#1a0dab]">
          {previewTitle}
        </p>
        <p className="line-clamp-2 text-[12px] leading-snug text-neutral-600">
          {previewDesc}
        </p>
      </div>

      <Label className="flex flex-col gap-0.5">
        <span className="flex items-center justify-between text-xs font-medium text-neutral-700">
          <span>Meta title</span>
          <Counter len={titleLen} ideal={TITLE_IDEAL} max={TITLE_MAX} />
        </span>
        <Input
          invalid={!!titleErr}
          maxLength={TITLE_MAX}
          placeholder={titleFallback || `e.g. Vitamin C Brightening Serum - ${COMPANY.name}`}
          {...register("metaTitle")}
        />
        {titleErr ? (
          <span className="text-[11px] text-ink">{titleErr}</span>
        ) : (
          <span className="text-[11px] text-neutral-500">
            Shown as the clickable headline in search results. Aim for ≤{TITLE_IDEAL}
            {" "}chars; falls back to the product title when blank.
          </span>
        )}
      </Label>

      <Label className="flex flex-col gap-0.5">
        <span className="flex items-center justify-between text-xs font-medium text-neutral-700">
          <span>Meta description</span>
          <Counter len={descLen} ideal={DESC_IDEAL} max={DESC_MAX} />
        </span>
        <textarea
          rows={3}
          maxLength={DESC_MAX}
          placeholder={
            descriptionFallback ||
            "A concise, keyword-rich summary that makes shoppers want to click."
          }
          {...register("metaDescription")}
          className={cn(
            "block w-full rounded-sm border bg-paper p-1 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
            descErr ? "border-ink" : "border-neutral-300",
          )}
        />
        {descErr ? (
          <span className="text-[11px] text-ink">{descErr}</span>
        ) : (
          <span className="text-[11px] text-neutral-500">
            The grey snippet under the title in search results. Aim for ≤{DESC_IDEAL}
            {" "}chars; falls back to the short description when blank.
          </span>
        )}
      </Label>
    </section>
  );
}

/** Live counter that turns amber past the "ideal" length and ink at the cap. */
function Counter({ len, ideal, max }: { len: number; ideal: number; max: number }) {
  const tone =
    len >= max ? "text-ink font-semibold" : len > ideal ? "text-amber-600" : "text-neutral-400";
  return (
    <span className={cn("tabular-nums text-[11px]", tone)}>
      {len}/{max}
    </span>
  );
}

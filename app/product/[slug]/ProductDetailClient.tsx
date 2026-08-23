"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  ShoppingCart,
  Share2,
  Ruler,
  Check,
  Tag,
  X,
  Info,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { Markdown, RatingStars } from "@/components/composed";
import { useCartStore, type CartAddOn } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useUIStore } from "@/store/uiStore";
import { trackProductView, trackAddToCart } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";
import type {
  ProductDetail,
  ProductVariant,
  SizeChart,
} from "@/types/catalog";
import type { PublicCustomizationConfig } from "@/types/customization";
import { usePublicCustomizations } from "@/hooks/useCustomizations";
import type { SiteSettingsDelivery } from "@/types/siteSettings";

function formatPrice(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}


// Default size chart - used when a product has no custom chart configured
const DEFAULT_SIZE_CHART: SizeChart = {
  unit: "cm",
  columns: ["Chest", "Waist", "Hip", "Length"],
  rows: [
    { size: "XS",  values: ["80–84", "64–68", "88–92", "63"] },
    { size: "S",   values: ["86–91", "70–75", "94–99", "65"] },
    { size: "M",   values: ["92–98", "76–81", "100–105", "68"] },
    { size: "L",   values: ["99–105", "82–87", "106–111", "70"] },
    { size: "XL",  values: ["106–112", "88–94", "112–118", "72"] },
    { size: "XXL", values: ["113–120", "95–102", "119–126", "74"] },
  ],
  notes: "General size guide - measurements may vary by style. When between sizes, size up.",
};

// ── Size Chart Drawer ─────────────────────────────────────────────────────────

function SizeChartDrawer({
  chart,
  open,
  onClose,
}: {
  chart: SizeChart;
  open: boolean;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Slide panel - right to left */}
      <aside
        role="dialog"
        aria-modal
        aria-label="Size guide"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-white shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-[24px] py-[16px]">
          <div className="flex items-center gap-[8px]">
            <Ruler className="h-[16px] w-[16px] text-neutral-500" aria-hidden />
            <h2 className="text-[16px] font-semibold text-neutral-900">Size guide</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-[16px] w-[16px]" aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-5 text-sm text-neutral-500">
            All measurements in{" "}
            <span className="font-medium text-ink">{chart.unit}</span>. For the best fit, measure
            yourself and compare to the chart.
          </p>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Size
                  </th>
                  {chart.columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, i) => (
                  <tr
                    key={row.size}
                    className={cn(
                      "border-b border-neutral-100 last:border-0 transition-colors",
                      i % 2 === 0 ? "bg-white" : "bg-neutral-50/60",
                    )}
                  >
                    <td className="px-4 py-3 font-semibold text-ink">{row.size}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className="px-4 py-3 text-neutral-700">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {chart.notes ? (
            <div className="mt-5 rounded-xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
              <p className="mb-1 font-medium text-ink">Notes</p>
              <p className="whitespace-pre-line leading-relaxed">{chart.notes}</p>
            </div>
          ) : null}

          {/* How to measure */}
          <div className="mt-4 rounded-xl border border-neutral-200 px-4 py-4 text-sm">
            <p className="mb-2 flex items-center gap-1.5 font-medium text-ink">
              <Info className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              How to measure
            </p>
            <ul className="flex flex-col gap-1.5 text-neutral-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-neutral-300">•</span>
                <span>
                  <strong className="text-ink">Chest</strong> - measure around the fullest part,
                  keeping the tape horizontal
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-neutral-300">•</span>
                <span>
                  <strong className="text-ink">Waist</strong> - measure around the narrowest part
                  of your torso
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-neutral-300">•</span>
                <span>
                  <strong className="text-ink">Length</strong> - from the highest shoulder point
                  down to the hem
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-neutral-300">•</span>
                <span>
                  Between sizes? We recommend sizing <strong className="text-ink">up</strong> for
                  a relaxed fit.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Jersey Customization ──────────────────────────────────────────────────────

// Common shape used by both the fallback catalog and API-fetched patches
interface PatchOption {
  id: string;
  name: string;
  abbr: string;
  color: string;
  imageUrl?: string;
  price: number;
}


const NAME_PRICE = 50;
const NUMBER_PRICE = 50;

/** Where the personalisation is printed. Front carries a number only. */
type PrintPlacement = "Both" | "Front" | "Back";

interface JerseyPersonalization {
  placement: PrintPlacement;
  nameEnabled: boolean;
  name: string;
  numberEnabled: boolean;
  number: string;
  patches: string[];
}

function JerseyCustomizer({
  value,
  onChange,
  currency,
  patches,
  namePriceBDT,
  showName,
  showNumber,
}: {
  value: JerseyPersonalization;
  onChange: (p: JerseyPersonalization) => void;
  currency: string;
  patches: PatchOption[];
  namePriceBDT: number;
  showName: boolean;
  showNumber: boolean;
}) {
  const togglePatch = (id: string) =>
    onChange({
      ...value,
      patches: value.patches.includes(id)
        ? value.patches.filter((p) => p !== id)
        : [...value.patches, id],
    });

  /* Placement gates what can be printed: a Front print carries a number
   * only, so switching to Front clears any entered name. */
  const setPlacement = (placement: PrintPlacement) =>
    onChange(
      placement === "Front"
        ? { ...value, placement, nameEnabled: false, name: "" }
        : { ...value, placement },
    );
  const nameVisible = showName && value.placement !== "Front";

  /* Tapping a patch's zoom affordance opens a large preview so the art is
   * actually inspectable (the grid thumbnails are small on mobile). */
  const [previewPatch, setPreviewPatch] = React.useState<PatchOption | null>(null);

  const patchCost = value.patches.reduce((sum, id) => {
    const p = patches.find((x) => x.id === id);
    return sum + (p?.price ?? 0);
  }, 0);
  const personalisationFee = (value.nameEnabled || value.numberEnabled) ? namePriceBDT : 0;
  const totalAddOn = personalisationFee + patchCost;
  const anyEnabled = value.nameEnabled || value.numberEnabled || value.patches.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-[16px] py-[10px]">
        <div className="flex items-center gap-[8px]">
          <span className="text-accent" aria-hidden>✦</span>
          <h3 className="text-[14px] font-semibold text-neutral-900">Personalise your jersey</h3>
        </div>
        {totalAddOn > 0 ? (
          <span className="rounded-[4px] bg-accent/10 px-[10px] py-[2px] text-[12px] font-bold text-accent">
            +{formatPrice(totalAddOn, currency)}
          </span>
        ) : anyEnabled ? (
          <span className="rounded-[4px] bg-neutral-100 px-[10px] py-[2px] text-[12px] font-medium text-neutral-500">
            Added
          </span>
        ) : (
          <span className="text-[12px] text-neutral-400">Optional</span>
        )}
      </div>

      <div className="flex flex-col gap-[4px] p-[16px]">
        {/* Print placement - Both / Front / Back. Front = number only. */}
        {showName && showNumber ? (
          <div className="flex flex-col gap-[8px] pb-[12px]">
            <span className="text-[14px] font-medium text-neutral-900">Select</span>
            <div className="flex gap-[8px]" role="radiogroup" aria-label="Print placement">
              {(["Both", "Front", "Back"] as const).map((p) => {
                const active = value.placement === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPlacement(p)}
                    className={cn(
                      "flex-1 rounded-lg border px-[12px] py-[8px] text-[13px] font-semibold transition-all duration-150",
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-white",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {value.placement === "Front" ? (
              <p className="text-[11px] text-neutral-400">Front print carries the number only.</p>
            ) : null}
          </div>
        ) : null}

        {/* Name on back */}
        {nameVisible ? (
          <div className="flex flex-col gap-[8px] border-t border-neutral-100 py-[12px]">
            <label className="flex cursor-pointer items-center gap-[10px]">
              <input
                type="checkbox"
                className="sr-only"
                checked={value.nameEnabled}
                onChange={() =>
                  onChange({ ...value, nameEnabled: !value.nameEnabled, name: !value.nameEnabled ? value.name : "" })
                }
              />
              <div
                aria-hidden
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-all",
                  value.nameEnabled ? "border-accent bg-accent text-white" : "border-neutral-300 bg-white",
                )}
              >
                {value.nameEnabled ? <Check className="h-[12px] w-[12px]" aria-hidden /> : null}
              </div>
              <span className="flex-1 select-none text-[14px] font-medium text-neutral-900">Name on back</span>
            </label>
            {value.nameEnabled ? (
              <input
                type="text"
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value.toUpperCase().slice(0, 12) })}
                placeholder="YOUR NAME"
                maxLength={12}
                autoFocus
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-[12px] py-[10px] text-[14px] font-bold uppercase tracking-widest text-neutral-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-300 focus:border-accent focus:bg-white focus:outline-none"
              />
            ) : null}
          </div>
        ) : null}

        {/* Squad number */}
        {showNumber ? (
          <div className="flex flex-col gap-[8px] border-t border-neutral-100 py-[12px]">
            <label className="flex cursor-pointer items-center gap-[10px]">
              <input
                type="checkbox"
                className="sr-only"
                checked={value.numberEnabled}
                onChange={() =>
                  onChange({ ...value, numberEnabled: !value.numberEnabled, number: !value.numberEnabled ? value.number : "" })
                }
              />
              <div
                aria-hidden
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-all",
                  value.numberEnabled ? "border-accent bg-accent text-white" : "border-neutral-300 bg-white",
                )}
              >
                {value.numberEnabled ? <Check className="h-[12px] w-[12px]" aria-hidden /> : null}
              </div>
              <span className="flex-1 select-none text-[14px] font-medium text-neutral-900">Squad number</span>
            </label>
            {value.numberEnabled ? (
              <input
                type="text"
                inputMode="numeric"
                value={value.number}
                autoFocus
                onChange={(e) => onChange({ ...value, number: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                placeholder="00"
                className="w-[64px] rounded-lg border border-neutral-200 bg-neutral-50 px-[12px] py-[8px] text-center text-[20px] font-black text-neutral-900 placeholder:text-neutral-300 focus:border-accent focus:bg-white focus:outline-none"
              />
            ) : null}
          </div>
        ) : null}

        {/* Personalisation fee strip */}
        {namePriceBDT > 0 && (showName || showNumber) ? (
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-[12px] py-[8px]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-neutral-900">Personalisation fee</span>
              <span className="text-[11px] text-neutral-500">Name, number, or both — charged once</span>
            </div>
            <span className={cn(
              "text-[14px] font-bold",
              personalisationFee > 0 ? "text-accent" : "text-neutral-400",
            )}>
              +{formatPrice(namePriceBDT, currency)}
            </span>
          </div>
        ) : null}

        {/* Patches */}
        <div className="flex flex-col gap-[8px] border-t border-neutral-100 pt-[12px]">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Badge &amp; patches</p>

          {/* Picker grid - 2-up on mobile so the art is readable, zoom
              button opens the large preview. */}
          <div className="grid grid-cols-2 gap-[8px] sm:grid-cols-3 md:grid-cols-4">
            {patches.map((patch) => {
              const selected = value.patches.includes(patch.id);
              return (
                <div key={patch.id} className="relative">
                  <button
                    type="button"
                    onClick={() => togglePatch(patch.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full flex-col items-center gap-[6px] rounded-lg border p-[10px] text-center transition-all duration-150",
                      selected
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white",
                    )}
                  >
                    {patch.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={patch.imageUrl} alt={patch.name} className="h-[64px] w-[64px] rounded-full object-cover" />
                    ) : (
                      <div
                        className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-[12px] font-bold text-white"
                        style={{ backgroundColor: patch.color }}
                      >
                        {patch.abbr}
                      </div>
                    )}
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight text-neutral-700">{patch.name}</span>
                    <span className="text-[12px] font-bold text-accent">+{formatPrice(patch.price, currency)}</span>
                    {selected ? (
                      <span className="absolute left-[6px] top-[6px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-white">
                        <Check className="h-[10px] w-[10px]" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPatch(patch)}
                    aria-label={`Preview ${patch.name}`}
                    title="View larger"
                    className="absolute right-[6px] top-[6px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-500 shadow-sm transition-colors hover:text-neutral-900"
                  >
                    <Maximize2 className="h-[11px] w-[11px]" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
            className="w-full max-w-[320px] rounded-xl bg-white p-[16px] text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPatch(null)}
                aria-label="Close preview"
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-[16px] w-[16px]" aria-hidden />
              </button>
            </div>
            {previewPatch.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewPatch.imageUrl}
                alt={previewPatch.name}
                className="mx-auto h-[200px] w-[200px] rounded-full object-cover shadow-md"
              />
            ) : (
              <div
                className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-full text-[32px] font-bold text-white shadow-md"
                style={{ backgroundColor: previewPatch.color }}
              >
                {previewPatch.abbr}
              </div>
            )}
            <p className="mt-[12px] text-[15px] font-semibold text-neutral-900">{previewPatch.name}</p>
            <p className="mt-[2px] text-[16px] font-bold text-accent">
              +{formatPrice(previewPatch.price, currency)}
            </p>
            <button
              type="button"
              onClick={() => {
                togglePatch(previewPatch.id);
                setPreviewPatch(null);
              }}
              className={cn(
                "mt-[12px] w-full rounded-lg py-[10px] text-[14px] font-bold transition-opacity",
                value.patches.includes(previewPatch.id)
                  ? "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
                  : "bg-accent text-white hover:opacity-90",
              )}
            >
              {value.patches.includes(previewPatch.id) ? "Remove patch" : "Add patch"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Product Detail Client ─────────────────────────────────────────────────────

export interface ProductDetailClientProps {
  product: ProductDetail;
  customizationConfig?: PublicCustomizationConfig | null;
  siteSettings?: { delivery?: SiteSettingsDelivery | null } | null;
  className?: string;
}

// ─── Full-screen image lightbox ────────────────────────────────────────────
function ImageLightbox({
  images,
  initialIndex,
  title,
  onClose,
}: {
  images: { url: string; alt?: string | null; _id?: string }[];
  initialIndex: number;
  title: string;
  onClose: (finalIdx: number) => void;
}) {
  const [idx, setIdx] = React.useState(initialIndex);
  const idxRef = React.useRef(initialIndex);
  const touchStartX = React.useRef<number | null>(null);
  const go = (i: number) => { setIdx(i); idxRef.current = i; };
  // Wrap around so both arrows always work (and stay visible) on any image.
  const prev = () => go((idxRef.current - 1 + images.length) % images.length);
  const next = () => go((idxRef.current + 1) % images.length);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(idxRef.current);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = saved;
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const stripRef = React.useRef<HTMLDivElement>(null);

  // Keep the active thumbnail visible as the user swipes / uses the arrows.
  React.useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${idx}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [idx]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - (e.changedTouches[0]?.clientX ?? 0);
    if (Math.abs(delta) > 40) delta > 0 ? next() : prev();
    touchStartX.current = null;
  };

  const current = images[idx];

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-[16px] py-[10px] pt-[max(10px,env(safe-area-inset-top))]">
        <span className="text-sm tabular-nums text-white/70">
          {idx + 1} <span className="mx-1 text-white/40">/</span> {images.length}
        </span>
        <button
          type="button"
          onClick={() => onClose(idxRef.current)}
          aria-label="Close"
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-[22px] w-[22px]" aria-hidden />
        </button>
      </div>

      {/* Main image area */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current ? (
          <div className="relative h-full w-full">
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt ?? title}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
          </div>
        ) : null}

        {/* Prev / Next arrows — always visible, navigation wraps around */}
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-[8px] top-1/2 z-10 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-neutral-900/70 text-white shadow-lg transition-colors hover:bg-neutral-900/90 active:bg-neutral-800 sm:left-[24px]"
            >
              <ChevronLeft className="h-[22px] w-[22px] -translate-x-[1px]" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-[8px] top-1/2 z-10 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-neutral-900/70 text-white shadow-lg transition-colors hover:bg-neutral-900/90 active:bg-neutral-800 sm:right-[24px]"
            >
              <ChevronRight className="h-[22px] w-[22px] translate-x-[1px]" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 ? (
        <div
          ref={stripRef}
          // Auto margins (not justify-center) keep the strip centered when it
          // fits but still fully scrollable when it overflows.
          className="flex shrink-0 gap-[8px] overflow-x-auto px-[16px] pt-[12px] pb-[max(12px,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
        >
          {images.map((img, i) => (
            <button
              key={img._id ?? i}
              data-thumb={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                i === idx
                  ? "border-white opacity-100"
                  : "border-white/20 opacity-50 hover:border-white/50 hover:opacity-80",
              )}
            >
              <Image src={img.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailClient({ product, customizationConfig, siteSettings, className }: ProductDetailClientProps) {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const addToCart = useCartStore((s) => s.add);
  const inWishlist = useWishlistStore((s) => s.has(product._id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  const [imageIdx, setImageIdx] = React.useState(0);
  // When true the hero area plays the product video instead of showing an image.
  const [showVideo, setShowVideo] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [zoomPoint, setZoomPoint] = React.useState<{ x: number; y: number } | null>(null);
  // Hover-zoom is desktop-only — disabled on touch / tablet and on viewports below lg
  const [canZoom, setCanZoom] = React.useState(false);
  const [qty, setQty] = React.useState(1);
  const [sizeChartOpen, setSizeChartOpen] = React.useState(false);
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [ctaVisible, setCtaVisible] = React.useState(true);
  const [ctaEverVisible, setCtaEverVisible] = React.useState(false);
  const [bottomPassed, setBottomPassed] = React.useState(false);
  const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Jersey personalization
  const [personalization, setPersonalization] = React.useState<JerseyPersonalization>({
    placement: "Both",
    nameEnabled: false,
    name: "",
    numberEnabled: false,
    number: "",
    patches: [],
  });

  // ── Variant axes ──────────────────────────────────────────────────────────
  const optionAxes = React.useMemo(() => {
    const axes = new Map<string, string[]>();
    for (const v of product.variants) {
      if (!v.options) continue;
      for (const [k, val] of Object.entries(v.options)) {
        const set = axes.get(k) ?? [];
        if (!set.includes(val)) set.push(val);
        axes.set(k, set);
      }
    }
    return Array.from(axes.entries());
  }, [product.variants]);

  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>(() => {
    const first =
      product.variants.find((v) => (v.isActive ?? true) && v.stock > 0) ?? product.variants[0];
    return first?.options ? { ...first.options } : {};
  });

  const matchedVariant: ProductVariant | undefined = React.useMemo(
    () =>
      product.variants.find((v) => {
        if (!v.options) return Object.keys(selectedOptions).length === 0;
        return Object.entries(v.options).every(([k, val]) => selectedOptions[k] === val);
      }),
    [product.variants, selectedOptions],
  );

  const effectivePrice = matchedVariant?.price ?? product.price;
  const effectiveCompareAt = matchedVariant?.compareAtPrice ?? product.compareAtPrice;
  const effectiveStock =
    product.variants.length > 0 ? matchedVariant?.stock ?? 0 : product.stock;
  const onSale = effectiveCompareAt !== undefined && effectiveCompareAt > effectivePrice;
  const discountPct = onSale
    ? Math.round(((effectiveCompareAt - effectivePrice) / effectiveCompareAt) * 100)
    : 0;
  const outOfStock = product.trackStock && effectiveStock <= 0;

  // How many of this exact variant is already sitting in the local cart.
  // Used to prevent adding beyond available stock.
  const existingCartQty = useCartStore((s) => {
    if (!product.trackStock) return 0;
    const vid = matchedVariant?._id;
    return (
      s.items.find(
        (i) =>
          i.productId === product._id &&
          (vid ? i.variantId === vid : !i.variantId),
      )?.qty ?? 0
    );
  });
  const remaining = product.trackStock
    ? Math.max(0, effectiveStock - existingCartQty)
    : 99;

  // Reset qty to 1 when the matched variant changes so stale qty doesn't carry over
  React.useEffect(() => {
    setQty(1);
  }, [matchedVariant?._id]);

  React.useEffect(() => {
    const ctaEl = ctaRef.current;
    if (!ctaEl) return;
    const ctaObs = new IntersectionObserver(([e]) => {
      const visible = !!e?.isIntersecting;
      if (visible) setCtaEverVisible(true);
      setCtaVisible(visible);
    }, { threshold: 0 });
    ctaObs.observe(ctaEl);

    const bottomEl = bottomRef.current;
    const bottomObs = bottomEl
      ? new IntersectionObserver(([e]) => setBottomPassed(!!e?.isIntersecting), { threshold: 0 })
      : null;
    if (bottomEl && bottomObs) bottomObs.observe(bottomEl);

    return () => {
      ctaObs.disconnect();
      bottomObs?.disconnect();
    };
  }, []);

  const heroImage =
    matchedVariant?.image
      ? { url: matchedVariant.image, alt: product.title }
      : (product.images[imageIdx] ?? product.images[0]);

  // ── Category data ─────────────────────────────────────────────────────────
  const primaryCategory =
    typeof product.category === "object" ? product.category : undefined;

  // ── Customization assignments ─────────────────────────────────────────────
  // The server-rendered prop can be stale (the PDP HTML sits in the Full
  // Route Cache for up to a minute); the client-side query re-fetches the
  // live config so a freshly saved admin assignment shows up immediately.
  const { data: liveCustomizations } = usePublicCustomizations();
  const activeConfig = liveCustomizations ?? customizationConfig;
  const assignments = activeConfig?.assignments ?? [];
  const apiPatches = activeConfig?.patches ?? [];
  const addOnPrices = activeConfig?.addOnPrices ?? { name: NAME_PRICE, number: NUMBER_PRICE };

  // Every category slug this product belongs to, directly or via ancestors:
  // the primary category chain PLUS the secondary `categories[]` (products
  // are often filed under a broad primary like "jerseys" with the specific
  // club/tournament as a secondary category). Category `path` is the full
  // slug chain ("jerseys/football-club-kits/arsenal"), so splitting it also
  // covers ancestors that aren't populated on the response.
  const allCategorySlugs = React.useMemo(() => {
    const slugs = new Set<string>();
    const addCategory = (c: { slug?: string; path?: string } | string | null | undefined) => {
      if (!c || typeof c !== "object") return;
      if (c.slug) slugs.add(c.slug);
      for (const seg of (c.path ?? "").split("/")) if (seg) slugs.add(seg);
    };
    addCategory(primaryCategory);
    for (const a of primaryCategory?.ancestors ?? []) addCategory(a);
    for (const c of product.categories ?? []) addCategory(c);
    return Array.from(slugs);
  }, [primaryCategory, product.categories]);

  // Find the most specific matching assignment: product-level first, then category
  const matchedAssignment = React.useMemo(() => {
    const productMatch = assignments.find(
      (a) => a.targetType === "product" && a.targetId === product._id,
    );
    if (productMatch) return productMatch;
    return (
      assignments.find(
        (a) => a.targetType === "category" && allCategorySlugs.includes(a.targetId),
      ) ?? null
    );
  }, [assignments, product._id, allCategorySlugs]);

  const isJerseyProduct = matchedAssignment !== null;
  const allowName = matchedAssignment?.allowName ?? true;
  const allowNumber = matchedAssignment?.allowNumber ?? true;

  const activePatchLibrary: PatchOption[] = React.useMemo(() => {
    if (!matchedAssignment) return [];
    const allActive = apiPatches
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p._id,
        name: p.name,
        abbr: p.abbreviation,
        color: p.color,
        imageUrl: p.imageUrl,
        price: p.price,
      }));
    if (matchedAssignment.allPatches) return allActive;
    return allActive.filter((p) => matchedAssignment.patchIds.includes(p.id));
  }, [matchedAssignment, apiPatches]);

  // ── Personalization add-on total ──────────────────────────────────────────
  const customTotal = React.useMemo(() => {
    if (!isJerseyProduct) return 0;
    let t = 0;
    const nameActive = personalization.nameEnabled && Boolean(personalization.name.trim());
    const numberActive = personalization.numberEnabled && Boolean(personalization.number.trim());
    if (nameActive || numberActive) t += addOnPrices.name;
    for (const id of personalization.patches) {
      const patch = activePatchLibrary.find((p) => p.id === id);
      if (patch) t += patch.price;
    }
    return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalization, isJerseyProduct, addOnPrices, activePatchLibrary]);

  const totalPrice = effectivePrice + customTotal;

  // ── Free delivery nudge ───────────────────────────────────────────────────
  const freeThreshold = siteSettings?.delivery?.freeShippingThreshold ?? 0;
  const orderValue = totalPrice * qty;
  const qualifiesForFree = freeThreshold > 0 && orderValue >= freeThreshold;
  const amountToFree = freeThreshold > 0 ? Math.max(0, freeThreshold - orderValue) : 0;

  // ── Seller ────────────────────────────────────────────────────────────────
  const brandName =
    typeof product.brand === "object" && product.brand ? product.brand.name : undefined;
  const brandSlug =
    typeof product.brand === "object" && product.brand ? product.brand.slug : undefined;

  const cartOptions: Record<string, string> | undefined = React.useMemo(() => {
    if (matchedVariant?.options && Object.keys(matchedVariant.options).length > 0) {
      return { ...matchedVariant.options };
    }
    return Object.keys(selectedOptions).length > 0 ? { ...selectedOptions } : undefined;
  }, [matchedVariant, selectedOptions]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    trackProductView({
      productId: product._id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      currency: product.currency,
      category: primaryCategory?.name,
      brand: brandName,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product._id]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onSelectOption = (axis: string, value: string) =>
    setSelectedOptions((prev) => ({ ...prev, [axis]: value }));

  const onAddToCart = () => {
    if (outOfStock) return;

    if (product.trackStock) {
      if (remaining <= 0) {
        toast({
          title: "Maximum quantity reached",
          description: `You already have all ${effectiveStock} available in your cart.`,
          tone: "error",
        });
        return;
      }
      if (qty > remaining) {
        toast({
          title: "Not enough stock",
          description: `Only ${remaining} more available - reduced to ${remaining}.`,
          tone: "info",
        });
        setQty(remaining);
        return;
      }
    }

    const customOptions: Record<string, string> = {};
    const addOns: CartAddOn[] = [];
    if (isJerseyProduct) {
      const nameActive = personalization.nameEnabled && Boolean(personalization.name.trim());
      const numberActive = personalization.numberEnabled && Boolean(personalization.number.trim());
      if (nameActive) customOptions["Name"] = personalization.name.trim();
      if (numberActive) customOptions["Number"] = personalization.number.trim();
      // Record where the print goes so POS / order views show the same
      // choice the buyer made (Front = number only).
      if (nameActive || numberActive) customOptions["Print"] = personalization.placement;
      if ((nameActive || numberActive) && addOnPrices.name > 0) {
        addOns.push({
          label:
            nameActive && numberActive
              ? "Name & number print"
              : nameActive
                ? "Name print"
                : "Number print",
          amount: addOnPrices.name,
        });
      }
      if (personalization.patches.length > 0) {
        const patchNames: string[] = [];
        for (const id of personalization.patches) {
          const patch = activePatchLibrary.find((p) => p.id === id);
          if (!patch) continue;
          patchNames.push(patch.name);
          addOns.push({ label: `Patch: ${patch.name}`, amount: patch.price });
        }
        if (patchNames.length) customOptions["Patches"] = patchNames.join(", ");
      }
    }
    addToCart({
      productId: product._id,
      variantId: matchedVariant?._id,
      options: { ...cartOptions, ...customOptions },
      slug: product.slug,
      title: product.title,
      image: heroImage?.url ?? "",
      price: totalPrice,
      originalPrice: effectiveCompareAt,
      basePrice: addOns.length > 0 ? effectivePrice : undefined,
      addOns: addOns.length > 0 ? addOns : undefined,
      qty,
      stock: product.trackStock ? effectiveStock : undefined,
    });
    trackAddToCart({
      productId: product._id,
      slug: product.slug,
      title: product.title,
      price: totalPrice,
      currency: product.currency,
      qty,
      variantId: matchedVariant?._id,
    });
    toast({ title: "Added to cart", description: product.title, tone: "success" });
  };

  const onBuyNow = () => {
    if (outOfStock) return;
    onAddToCart();
    router.push("/checkout");
  };

  const onToggleWishlist = () =>
    toggleWishlist({
      productId: product._id,
      slug: product.slug,
      title: product.title,
      image: heroImage?.url ?? "",
      price: totalPrice,
    });

  const onShare = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: product.title, url });
      } catch {
        // user cancelled - no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard", tone: "success" });
    }
  };

  React.useEffect(() => {
    const mq = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 1024px)",
    );
    const update = () => setCanZoom(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const onGalleryTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0]?.clientX ?? null);
  const onGalleryTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || product.images.length <= 1) return;
    const delta = touchStartX - (e.changedTouches[0]?.clientX ?? 0);
    if (Math.abs(delta) > 40) {
      // Swiping while the video is up returns to the image gallery.
      if (showVideo) setShowVideo(false);
      else {
        setImageIdx((i) =>
          delta > 0 ? Math.min(product.images.length - 1, i + 1) : Math.max(0, i - 1),
        );
      }
    }
    setTouchStartX(null);
  };

  const productVideo = product.video ?? null;
  const selectImage = (i: number) => {
    setImageIdx(i);
    setShowVideo(false);
  };
  // The thumbnail rails render when there's more than one thing to pick from.
  const galleryCount = product.images.length + (productVideo ? 1 : 0);

  // Is the size axis present? - used to position "Size Guide" next to it
  const sizeAxisIndex = optionAxes.findIndex(([axis]) =>
    axis.toLowerCase().includes("size"),
  );
  // Always show size guide - use the product's own chart or the default general guide
  const sizeChart = product.sizeChart ?? DEFAULT_SIZE_CHART;
  const hasSizeChart = true;

  return (
    <section className={cn("pb-24 lg:pb-0", className)}>
      {/* Size chart drawer */}
      <SizeChartDrawer
        chart={sizeChart}
        open={sizeChartOpen}
        onClose={() => setSizeChartOpen(false)}
      />

      {/* Full-screen image lightbox */}
      {lightboxOpen ? (
        <ImageLightbox
          images={product.images}
          initialIndex={imageIdx}
          title={product.title}
          onClose={(finalIdx) => { setLightboxOpen(false); setImageIdx(finalIdx); }}
        />
      ) : null}

      {/*
        FC Barcelona / Fanatics-style PDP layout (2-column):
        - lg+:    [Large gallery, sticky] | [Info column with inline buy block]
        - md:     same 2-col, narrower info column
        - mobile: [Gallery] → [Info + CTA] stacked, sticky add-to-bag bar
      */}
      <div className="grid grid-cols-1 gap-3 md:gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">

        {/* ── GALLERY (col 1 — large, sticky) ─────────────────────────── */}
        <div className="md:sticky md:top-4 md:self-start">
          <div className="-mx-2 sm:mx-0 flex gap-2 sm:gap-3">

            {/* Vertical thumbnail rail (sm+) */}
            {galleryCount > 1 ? (
              <ul className="hidden sm:flex w-[64px] shrink-0 flex-col gap-2 overflow-y-auto" style={{ maxHeight: "480px" }}>
                {product.images.map((img, i) => (
                  <li key={img._id ?? i} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => selectImage(i)}
                      onMouseEnter={() => selectImage(i)}
                      aria-label={`Show image ${i + 1}`}
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-lg border-2 transition-all",
                        !showVideo && i === imageIdx
                          ? "border-ink shadow-sm"
                          : "border-neutral-200 hover:border-neutral-400",
                      )}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt ?? product.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  </li>
                ))}
                {productVideo ? (
                  <li className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowVideo(true)}
                      aria-label="Play product video"
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-lg border-2 bg-neutral-900 transition-all",
                        showVideo ? "border-ink shadow-sm" : "border-neutral-200 hover:border-neutral-400",
                      )}
                    >
                      {productVideo.posterUrl ? (
                        <Image
                          src={productVideo.posterUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : null}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white/90">
                          <Play className="h-[12px] w-[12px] translate-x-[1px] fill-ink text-ink" aria-hidden />
                        </span>
                      </span>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {/* Main image */}
            <div className="min-w-0 flex-1">
              {/* Fullscreen lightbox is desktop-only (canZoom = fine pointer +
                  hover). On mobile/tablet a tap does nothing - swipe changes
                  images instead. */}
              <div
                role={canZoom ? "button" : undefined}
                tabIndex={canZoom ? 0 : undefined}
                aria-label={showVideo ? "Product video" : canZoom ? "View full screen" : undefined}
                className={cn(
                  "group relative aspect-[4/5] w-full overflow-hidden bg-neutral-50 outline-none sm:rounded-xl sm:border sm:border-neutral-100",
                  showVideo || !canZoom ? "cursor-default" : "cursor-zoom-in",
                )}
                onClick={() => canZoom && !showVideo && heroImage && setLightboxOpen(true)}
                onKeyDown={(e) => e.key === "Enter" && canZoom && !showVideo && heroImage && setLightboxOpen(true)}
                onTouchStart={onGalleryTouchStart}
                onTouchEnd={onGalleryTouchEnd}
                onMouseMove={canZoom && !showVideo ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoomPoint({
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100,
                  });
                } : undefined}
                onMouseLeave={canZoom && !showVideo ? () => setZoomPoint(null) : undefined}
              >
                {showVideo && productVideo ? (
                  <video
                    key={productVideo.url}
                    src={productVideo.url}
                    poster={productVideo.posterUrl}
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full bg-black object-contain"
                  />
                ) : heroImage ? (
                  <div
                    className="absolute inset-0"
                    style={canZoom && zoomPoint ? {
                      transform: "scale(2.2)",
                      transformOrigin: `${zoomPoint.x}% ${zoomPoint.y}%`,
                      transition: "transform 0.08s ease-out",
                    } : {
                      transform: "scale(1)",
                      transition: "transform 0.25s ease-out",
                    }}
                  >
                    <Image
                      src={heroImage.url}
                      alt={heroImage.alt ?? product.title}
                      fill
                      priority
                      sizes="(min-width: 1280px) 35vw, (min-width: 1024px) 45vw, 100vw"
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                    No image
                  </div>
                )}
                {onSale ? (
                  <Badge variant="solid" className="absolute left-3 top-3 text-sm font-semibold">
                    -{discountPct}%
                  </Badge>
                ) : null}
                {/* Expand hint — visible on hover (desktop) */}
                {heroImage && !showVideo && canZoom ? (
                  <span className="pointer-events-none absolute right-3 top-3 flex h-[32px] w-[32px] items-center justify-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
                {/* Swipe dots - mobile only */}
                {product.images.length > 1 && !showVideo ? (
                  <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
                    {product.images.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-200",
                          i === imageIdx ? "w-5 bg-ink" : "w-1.5 bg-ink/40",
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Horizontal thumbnail strip - mobile only */}
              {galleryCount > 1 ? (
                <ul className="mt-2 flex gap-1.5 overflow-x-auto px-2 pb-1 sm:hidden sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {product.images.map((img, i) => (
                    <li key={img._id ?? i} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => selectImage(i)}
                        aria-label={`Show image ${i + 1}`}
                        className={cn(
                          "relative h-[52px] w-[52px] overflow-hidden rounded-lg border-2 transition-all",
                          !showVideo && i === imageIdx ? "border-ink" : "border-neutral-200",
                        )}
                      >
                        <Image
                          src={img.url}
                          alt={img.alt ?? product.title}
                          fill
                          sizes="52px"
                          className="object-cover"
                        />
                      </button>
                    </li>
                  ))}
                  {productVideo ? (
                    <li className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowVideo(true)}
                        aria-label="Play product video"
                        className={cn(
                          "relative h-[52px] w-[52px] overflow-hidden rounded-lg border-2 bg-neutral-900 transition-all",
                          showVideo ? "border-ink" : "border-neutral-200",
                        )}
                      >
                        {productVideo.posterUrl ? (
                          <Image
                            src={productVideo.posterUrl}
                            alt=""
                            fill
                            sizes="52px"
                            className="object-cover"
                          />
                        ) : null}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white/90">
                            <Play className="h-[10px] w-[10px] translate-x-[1px] fill-ink text-ink" aria-hidden />
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── PRODUCT INFO (col 2) ─────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-[16px]">

          {/* Brand · Title · Rating · Price — Flowbite hierarchy */}
          <div className="flex flex-col gap-[8px]">
            {brandName ? (
              <Link
                href={brandSlug ? `/all-products?brand=${encodeURIComponent(brandSlug)}` : "#"}
                className="w-fit text-[13px] font-medium uppercase tracking-wide text-neutral-400 transition-colors hover:text-neutral-600"
              >
                {brandName}
              </Link>
            ) : null}

            <h1 className="text-[20px] font-semibold normal-case leading-snug tracking-normal text-neutral-900 sm:text-[24px]">
              {product.title}
            </h1>

            {product.ratingCount > 0 ? (
              <button
                type="button"
                onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
                className="flex w-fit items-center gap-[8px] text-[13px] text-neutral-500 transition-colors hover:text-neutral-700"
              >
                <RatingStars value={product.ratingAverage} size="sm" />
                <span>
                  {product.ratingAverage.toFixed(1)} · {product.ratingCount.toLocaleString()} reviews
                </span>
              </button>
            ) : null}

            <div className="flex flex-wrap items-center gap-[8px]">
              <span className="text-[24px] font-extrabold leading-none tracking-tight text-neutral-900 sm:text-[28px]">
                {formatPrice(totalPrice, product.currency)}
              </span>
              {onSale ? (
                <span className="text-[14px] text-neutral-400 line-through">
                  {formatPrice(effectiveCompareAt, product.currency)}
                </span>
              ) : null}
              {onSale ? (
                <span className="rounded-[4px] bg-green-100 px-[8px] py-[2px] text-[12px] font-semibold text-green-800">
                  {discountPct}% off
                </span>
              ) : null}
            </div>

            {customTotal > 0 ? (
              <p className="text-[12px] text-neutral-500">
                Base {formatPrice(effectivePrice, product.currency)} + personalisation{" "}
                <span className="font-semibold text-accent">{formatPrice(customTotal, product.currency)}</span>
              </p>
            ) : null}

            {product.activeOffer ? (
              <Link
                href={`/offers/${product.activeOffer.slug}`}
                className="inline-flex w-fit items-center gap-[4px] text-[13px] font-semibold text-accent hover:underline"
              >
                <Tag className="h-[14px] w-[14px]" aria-hidden />
                {product.activeOffer.name}
              </Link>
            ) : null}
          </div>

          {/* ③ Short description */}
          {product.shortDescription ? (
            <p className="text-[14px] leading-relaxed text-neutral-500">{product.shortDescription}</p>
          ) : null}

          {/* Variant pickers */}
          {optionAxes.length > 0 ? (
            <div className="flex flex-col gap-[16px]">
              {optionAxes.map(([axis, values]) => {
                const isSizeAxis = axis.toLowerCase().includes("size");
                return (
                  <div key={axis} className="flex flex-col gap-[8px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-neutral-900">
                        {axis}
                        {selectedOptions[axis] ? (
                          <span className="ml-[8px] font-normal text-neutral-500">
                            {selectedOptions[axis]}
                          </span>
                        ) : null}
                      </span>
                      {isSizeAxis && hasSizeChart ? (
                        <button
                          type="button"
                          onClick={() => setSizeChartOpen(true)}
                          className="inline-flex items-center gap-[6px] text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
                        >
                          <Ruler className="h-[14px] w-[14px]" aria-hidden />
                          Size guide
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-[8px]">
                      {values.map((v) => {
                        const active = selectedOptions[axis] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => onSelectOption(axis, v)}
                            className={cn(
                              "inline-flex h-[40px] min-w-[48px] items-center justify-center rounded-lg border px-[12px] text-[14px] font-medium transition-all duration-150",
                              active
                                ? "border-accent bg-accent text-white"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400",
                            )}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {sizeAxisIndex === -1 && hasSizeChart ? (
                <button
                  type="button"
                  onClick={() => setSizeChartOpen(true)}
                  className="w-fit text-[11px] text-neutral-400 underline underline-offset-2 hover:text-ink"
                >
                  Size guide
                </button>
              ) : null}
            </div>
          ) : hasSizeChart ? (
            <button
              type="button"
              onClick={() => setSizeChartOpen(true)}
              className="w-fit text-[11px] text-neutral-400 underline underline-offset-2 hover:text-ink"
            >
              Size guide
            </button>
          ) : null}

          {/* Buy block — single column, Flowbite spacing */}
          <div ref={ctaRef} className="flex flex-col gap-[12px] border-t border-neutral-100 pt-[16px]">

            {/* Stock */}
            {outOfStock ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                Out of stock
              </span>
            ) : effectiveStock < 10 && product.trackStock ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                Only {effectiveStock} left
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
                In stock
              </span>
            )}

            {/* Qty stepper */}
            <div className="flex items-center gap-[12px]">
              <span className="text-[14px] font-medium text-neutral-900">Qty</span>
              <div className="inline-flex items-center rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center text-xl text-neutral-500 transition-colors hover:text-ink disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-9 select-none border-x border-neutral-200 py-2 text-center text-sm font-bold text-ink">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(remaining, q + 1))}
                  disabled={product.trackStock && qty >= remaining}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center text-xl text-neutral-500 transition-colors hover:text-ink disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>

            {/* Delivery nudge */}
            {freeThreshold > 0 ? (
              qualifiesForFree ? (
                <p className="text-xs font-medium text-green-600">Free delivery applies to this order</p>
              ) : (
                <p className="text-xs text-neutral-400">
                  Add{" "}
                  <span className="font-medium text-neutral-600">
                    {formatPrice(amountToFree, product.currency)}
                  </span>{" "}
                  more for free delivery
                </p>
              )
            ) : null}

            {/* Add to cart - Flowbite primary in the Solobo accent */}
            <button
              type="button"
              onClick={onAddToCart}
              disabled={outOfStock}
              className="flex h-[48px] w-full items-center justify-center gap-[8px] rounded-lg bg-accent text-[15px] font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.99] disabled:opacity-40"
            >
              <ShoppingCart className="h-[18px] w-[18px]" aria-hidden />
              {outOfStock ? "Out of stock" : "Add to cart"}
            </button>

            {/* Buy now - Flowbite alternative */}
            <button
              type="button"
              onClick={onBuyNow}
              disabled={outOfStock}
              className="flex h-[48px] w-full items-center justify-center rounded-lg border border-neutral-300 bg-white text-[15px] font-semibold text-neutral-900 transition-all hover:bg-neutral-100 active:scale-[0.99] disabled:opacity-40"
            >
              Buy now
            </button>

            {/* Wishlist + Share */}
            <div className="flex items-center justify-center gap-5 pt-1">
              <button
                type="button"
                onClick={onToggleWishlist}
                className={cn(
                  "flex items-center gap-1.5 text-[12px] font-medium transition-colors",
                  inWishlist ? "text-red-500" : "text-neutral-400 hover:text-ink",
                )}
              >
                <Heart className={cn("h-3.5 w-3.5", inWishlist && "fill-red-500")} aria-hidden />
                {inWishlist ? "Wishlisted" : "Wishlist"}
              </button>
              <span className="text-neutral-200" aria-hidden>|</span>
              <button
                type="button"
                onClick={onShare}
                className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-400 transition-colors hover:text-ink"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden />
                Share
              </button>
            </div>

            {/* Trust */}
            <p className="text-center text-[10.5px] text-neutral-400">
              {freeThreshold > 0
                ? `Free delivery over ${formatPrice(freeThreshold, product.currency)}`
                : "Cash on delivery"}
              {" · "}7-day returns{" · "}Secure checkout
            </p>
          </div>

          {/* Description — inline expand/collapse */}
          {product.description ? (
            <div>
              <div
                className={cn(
                  "relative overflow-hidden text-[13px] leading-relaxed text-neutral-500 transition-[max-height] duration-500 sm:text-sm",
                  !descExpanded ? "max-h-[76px]" : "max-h-[2000px]",
                )}
              >
                <Markdown content={product.description} />
                {!descExpanded ? (
                  <div className="absolute inset-x-0 bottom-0 h-[32px] bg-gradient-to-t from-paper to-transparent" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDescExpanded((p) => !p)}
                className="mt-1 text-[11px] font-medium text-neutral-400 underline underline-offset-2 transition-colors hover:text-ink"
              >
                {descExpanded ? "Show less" : "Show more"}
              </button>
            </div>
          ) : null}

          {/* Jersey customizer */}
          {isJerseyProduct ? (
            <div>
              <JerseyCustomizer
                value={personalization}
                onChange={setPersonalization}
                currency={product.currency}
                patches={activePatchLibrary}
                namePriceBDT={addOnPrices.name}
                showName={allowName}
                showNumber={allowNumber}
              />
            </div>
          ) : null}

        </div>
      </div>

      {/* Sentinel — hides sticky bar once user scrolls past the product grid */}
      <div ref={bottomRef} aria-hidden className="pointer-events-none h-px" />

      {/* Sticky ATC bar - shows when inline CTA scrolls out of view; hidden on lg+ (info column keeps the CTA in view) */}
      <div
        aria-hidden={!ctaEverVisible || ctaVisible || bottomPassed}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-paper/95 backdrop-blur-sm lg:hidden",
          "transition-transform duration-300 ease-out",
          ctaEverVisible && !ctaVisible && !bottomPassed ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex w-full items-center gap-2 px-2 pt-[12px]" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {heroImage ? (
            <div className="relative h-[40px] w-[40px] shrink-0 overflow-hidden rounded-lg border border-neutral-200">
              <Image src={heroImage.url} alt="" fill sizes="40px" className="object-cover" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-[11px] text-neutral-500">{product.title}</p>
            <p className="text-sm font-bold text-ink">{formatPrice(totalPrice, product.currency)}</p>
          </div>
          <button
            type="button"
            onClick={onAddToCart}
            disabled={outOfStock}
            className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 text-[12px] font-bold uppercase tracking-wide text-paper transition-all hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden />
            {outOfStock ? "Out of stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </section>
  );
}

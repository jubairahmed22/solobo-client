"use client";

/**
 * BannerCarouselManager
 * ─────────────────────────────────────────────────────────────────────────
 * The drag-drop banner editor for the admin offer form. Built to feel like
 * a tiny CMS surface:
 *
 *  • Dropzone accepts multiple images at once → each upload becomes its
 *    own banner with sensible defaults, signed straight to Cloudinary so
 *    the Node process never sees the bytes.
 *  • Banner cards expose per-slide title / subtitle / CTA label + href,
 *    plus `isActive` and `fullWidth` toggles. The CTA href has a
 *    structured picker (Custom URL / Product / Category / This offer /
 *    Offers index) that resolves to a plain string the backend stores
 *    verbatim - the storefront renderer decides between `<Link>` and
 *    `<a target="_blank">` at draw time.
 *  • Native HTML5 drag-and-drop reorders cards. We avoid pulling in
 *    `@dnd-kit/sortable` because the list is at most a handful of items
 *    and the existing `ImageUploader` already proves the native API works
 *    well enough for this scale.
 *  • Live preview pane mirrors the storefront hero so the moderator can
 *    see exactly how each slide will render before saving.
 *
 * Designed as a controlled component: parent owns the array, this just
 * emits an updated copy on every mutation. The Offer form wires it via
 * react-hook-form's `<Controller>` so the field-array `move/append/remove`
 * machinery isn't needed - the manager handles its own internals.
 */

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge, Button, Input, Label } from "@/components/ui";
import { Select, type SelectOption } from "./Select";
import { uploadsApi, uploadToCloudinary, UploadError } from "@/lib/api/uploads";
import { useUIStore } from "@/store/uiStore";
import { catalogApi } from "@/lib/api/catalog";
import { adminApi } from "@/lib/api/admin";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils/cn";

/* ───────────────────── Types ───────────────────── */

/**
 * Wire-compatible shape for a single banner card. Mirrors the form schema
 * in `OfferFormClient` - every field is required because the form-level
 * zod resolver pre-fills sensible empty strings / booleans before the
 * value ever reaches us. The parent collapses empty strings to `undefined`
 * when building the wire payload.
 */
export interface BannerDraft {
  image: string;
  publicId: string;
  /** Portrait image used on mobile viewports (< 640 px). Empty = fall back to `image`. */
  mobileImage: string;
  mobilePublicId: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  fullWidth: boolean;
}

export interface BannerCarouselManagerProps {
  /** Current ordered list of banners. */
  value: BannerDraft[];
  /** Called with the next array on every add / remove / reorder / edit. */
  onChange: (next: BannerDraft[]) => void;
  /**
   * Slug of the offer being edited. Used by the CTA "This offer" preset to
   * resolve to `/offers/{slug}` - passed in rather than derived locally so
   * the manager doesn't have to know the form schema.
   */
  offerSlug?: string;
  /** Hard cap on how many banners can be added. Defaults to 8. */
  max?: number;
  /** Max upload size in MB per file. Defaults to 8MB. */
  maxSizeMb?: number;
  /**
   * Per-banner error map keyed by index. When a field is invalid we draw a
   * red ring on the relevant input - the parent form keeps the message
   * authority because zod issues are easier to read in one place.
   */
  errors?: Array<Partial<Record<keyof BannerDraft, string | undefined>> | undefined>;
  /** Disable interactivity (used while the form is saving). */
  disabled?: boolean;
}

interface PendingUpload {
  id: string;
  file: File;
  progress: number;
  error?: string;
}

let pendingIdCounter = 0;
function nextPendingId() {
  pendingIdCounter += 1;
  return `pending-${pendingIdCounter}`;
}

/* ───────────────────── CTA link kinds ─────────────────────
 *
 * The CTA href stores the final string on disk, but the picker needs to
 * remember which preset produced it so the dropdown stays in sync after
 * round-trips. We don't persist the kind - instead we infer it from the
 * URL on mount and let local state take over.
 */

type CtaLinkKind = "custom" | "product" | "category" | "this-offer" | "offers-index";

const CTA_OPTIONS: SelectOption[] = [
  { value: "custom", label: "Custom URL" },
  { value: "product", label: "Product page" },
  { value: "category", label: "Category page" },
  { value: "this-offer", label: "This offer's landing page" },
  { value: "offers-index", label: "All offers index (/offers)" },
];

function inferCtaKind(href: string): CtaLinkKind {
  const trimmed = href.trim();
  if (!trimmed) return "custom";
  if (trimmed === "/offers") return "offers-index";
  if (/^\/offers\/[^/]+$/.test(trimmed)) return "this-offer";
  if (/^\/products\/[^/]+$/.test(trimmed)) return "product";
  if (/^\/categories\/[^/]+$/.test(trimmed)) return "category";
  return "custom";
}

/* ───────────────────── Component ───────────────────── */

export function BannerCarouselManager({
  value,
  onChange,
  offerSlug,
  max = 8,
  maxSizeMb = 8,
  errors,
  disabled = false,
}: BannerCarouselManagerProps) {
  const toast = useUIStore((s) => s.toast);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [isDragging, setDragging] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Capture the latest value for the async upload chain - multiple concurrent
  // signs can complete out of order, and each one needs to splice into the
  // current array rather than the stale snapshot from when it started.
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const remainingSlots = Math.max(0, max - value.length - pending.length);
  const atCapacity = remainingSlots === 0;

  // Keep the preview pointer in bounds when banners get added / removed.
  React.useEffect(() => {
    if (value.length === 0) {
      setPreviewIndex(0);
    } else if (previewIndex >= value.length) {
      setPreviewIndex(value.length - 1);
    }
  }, [value.length, previewIndex]);

  /* ───────── Mutations ───────── */

  function setBanner(index: number, patch: Partial<BannerDraft>) {
    onChange(
      value.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  }

  function removeBanner(index: number) {
    const target = value[index];
    onChange(value.filter((_, i) => i !== index));
    if (target?.publicId) {
      // Best-effort: the banner's gone from the offer either way, but the
      // Cloudinary asset would otherwise leak storage.
      uploadsApi.destroy(target.publicId).catch(() => {
        /* swallow */
      });
    }
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    if (from >= value.length || to >= value.length) return;
    const next = value.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange(next);
    // Keep the preview pinned to the banner the user just moved so they
    // can verify the new order visually.
    setPreviewIndex(to);
  }

  function appendBlankBanner() {
    if (atCapacity || disabled) return;
    onChange([
      ...value,
      {
        image: "",
        publicId: "",
        mobileImage: "",
        mobilePublicId: "",
        title: "",
        subtitle: "",
        ctaLabel: "",
        ctaHref: "",
        isActive: true,
        fullWidth: true,
      },
    ]);
  }

  /* ───────── Upload pipeline ───────── */

  async function handleFiles(fileList: FileList | File[]) {
    if (disabled) return;
    if (remainingSlots === 0) {
      toast({
        title: `Maximum ${max} banners`,
        description: "Remove one before adding another.",
        tone: "info",
      });
      return;
    }

    const files = Array.from(fileList).slice(0, remainingSlots);
    const cap = maxSizeMb * 1024 * 1024;
    const okFiles: File[] = [];
    for (const f of files) {
      if (f.size > cap) {
        toast({
          title: `${f.name} is too large`,
          description: `Banners must be under ${maxSizeMb}MB.`,
          tone: "error",
        });
        continue;
      }
      if (!f.type.startsWith("image/")) {
        toast({ title: `${f.name} isn't an image`, tone: "error" });
        continue;
      }
      okFiles.push(f);
    }
    if (okFiles.length === 0) return;

    const queued: PendingUpload[] = okFiles.map((file) => ({
      id: nextPendingId(),
      file,
      progress: 0,
    }));
    setPending((prev) => [...prev, ...queued]);

    await Promise.all(
      queued.map(async (p) => {
        try {
          const sig = await uploadsApi.sign("offer");
          const result = await uploadToCloudinary(p.file, sig, (pct) => {
            setPending((prev) =>
              prev.map((q) => (q.id === p.id ? { ...q, progress: pct } : q)),
            );
          });
          const nextBanner: BannerDraft = {
            image: result.secure_url,
            publicId: result.public_id,
            mobileImage: "",
            mobilePublicId: "",
            title: "",
            subtitle: "",
            ctaLabel: "",
            ctaHref: "",
            isActive: true,
            fullWidth: true,
          };
          // Use the ref so back-to-back uploads append correctly.
          onChange([...valueRef.current, nextBanner]);
        } catch (err) {
          const message =
            err instanceof UploadError ? err.message : "Upload failed";
          setPending((prev) =>
            prev.map((q) => (q.id === p.id ? { ...q, error: message } : q)),
          );
          toast({
            title: `Couldn't upload ${p.file.name}`,
            description: message,
            tone: "error",
          });
        } finally {
          setTimeout(() => {
            setPending((prev) =>
              prev.filter((q) => q.id !== p.id || q.error),
            );
          }, 400);
        }
      }),
    );
  }

  const onPick = () => fileInputRef.current?.click();
  const activeBanner = value[previewIndex];

  /* ───────── Render ───────── */

  return (
    <div className="flex flex-col gap-1">
      {/* Preview pane - drawn first so the moderator sees the result above */}
      {value.length > 0 ? (
        <PreviewPane
          banners={value}
          index={previewIndex}
          onPrev={() =>
            setPreviewIndex((i) => (i - 1 + value.length) % value.length)
          }
          onNext={() => setPreviewIndex((i) => (i + 1) % value.length)}
        />
      ) : null}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!atCapacity && !disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (atCapacity || disabled) return;
          if (e.dataTransfer.files?.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed p-2 text-center transition-colors",
          isDragging
            ? "border-ink bg-neutral-50"
            : "border-neutral-300 bg-paper",
          (atCapacity || disabled) && "opacity-60",
        )}
      >
        <ImagePlus className="h-3 w-3 text-neutral-500" aria-hidden />
        <p className="text-sm text-ink">
          {atCapacity
            ? `Maximum ${max} banners reached`
            : "Drop banner images here, or"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onPick}
            disabled={atCapacity || disabled}
          >
            Choose files
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={appendBlankBanner}
            disabled={atCapacity || disabled}
          >
            <Plus className="h-2 w-2" aria-hidden />
            <span className="ml-0.5">Add blank slide</span>
          </Button>
        </div>
        <p className="text-[11px] text-neutral-500">
          Up to {max} slides, {maxSizeMb}MB each. JPG, PNG, WEBP or AVIF.
          Recommended ratio 16:5 for hero, 4:1 for category strips.
        </p>
      </div>

      {/* In-flight uploads */}
      {pending.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 rounded-sm border border-neutral-200 bg-paper p-1 text-xs"
            >
              {p.error ? (
                <span className="text-ink">!</span>
              ) : (
                <Loader2
                  className="h-2 w-2 animate-spin text-neutral-500"
                  aria-hidden
                />
              )}
              <span className="flex-1 min-w-0 truncate text-neutral-700">
                {p.file.name}
              </span>
              {p.error ? (
                <span className="text-[11px] text-ink">{p.error}</span>
              ) : (
                <span className="tabular-nums text-neutral-500">
                  {p.progress}%
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Cards */}
      {value.length === 0 && pending.length === 0 ? (
        <p className="rounded-sm border border-dashed border-neutral-300 p-1 text-center text-xs text-neutral-500">
          No banners yet. Drop an image above to start the carousel.
        </p>
      ) : null}

      {value.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {value.map((banner, i) => (
            <BannerCard
              key={`${banner.publicId || banner.image || "blank"}-${i}`}
              index={i}
              total={value.length}
              banner={banner}
              isPreviewing={i === previewIndex}
              isDragTarget={dragIndex === i}
              offerSlug={offerSlug}
              error={errors?.[i]}
              disabled={disabled}
              onPreview={() => setPreviewIndex(i)}
              onChange={(patch) => setBanner(i, patch)}
              onRemove={() => removeBanner(i)}
              onMoveUp={() => i > 0 && reorder(i, i - 1)}
              onMoveDown={() =>
                i < value.length - 1 && reorder(i, i + 1)
              }
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              onDropOnto={() => {
                if (dragIndex === null) return;
                reorder(dragIndex, i);
                setDragIndex(null);
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ───────────────────── Preview pane ───────────────────── */

interface PreviewPaneProps {
  banners: BannerDraft[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
}

function PreviewPane({ banners, index, onPrev, onNext }: PreviewPaneProps) {
  const banner = banners[index];
  if (!banner) return null;
  const activeCount = banners.filter((b) => b.isActive).length;
  const [mobileView, setMobileView] = React.useState(false);

  const previewImage = mobileView
    ? (banner.mobileImage || banner.image)
    : banner.image;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-0.5">
          <Layers className="h-2 w-2" aria-hidden />
          Preview · slide {index + 1} of {banners.length} ·{" "}
          {activeCount} active
        </span>
        <div className="flex items-center gap-0.5">
          {/* Desktop / Mobile preview toggle */}
          <button
            type="button"
            onClick={() => setMobileView(false)}
            className={cn(
              "rounded-sm px-1 py-0.5 text-[11px] font-medium transition-colors",
              !mobileView ? "bg-ink text-paper" : "text-neutral-500 hover:text-ink",
            )}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setMobileView(true)}
            className={cn(
              "rounded-sm px-1 py-0.5 text-[11px] font-medium transition-colors",
              mobileView ? "bg-ink text-paper" : "text-neutral-500 hover:text-ink",
            )}
          >
            Mobile
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={banners.length < 2}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-2 w-2" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={banners.length < 2}
            aria-label="Next slide"
          >
            <ChevronRight className="h-2 w-2" aria-hidden />
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 transition-all",
          mobileView ? "mx-auto aspect-[4/3] max-w-[260px]" : "aspect-[16/5]",
          !banner.isActive && "opacity-60",
        )}
      >
        {previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewImage}
            alt={banner.title || "Banner preview"}
            className="absolute inset-0 h-full w-full object-fill"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-neutral-400">
            <ImageIcon className="h-4 w-4" aria-hidden />
            {mobileView && !banner.mobileImage ? (
              <span className="text-[10px]">No mobile image — using desktop</span>
            ) : null}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-ink/20 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-end gap-0.5 p-2 text-paper">
          {banner.subtitle ? (
            <span className="text-[11px] uppercase tracking-wide opacity-80">
              {banner.subtitle}
            </span>
          ) : null}
          {banner.title ? (
            <h3 className="text-lg font-semibold leading-tight">
              {banner.title}
            </h3>
          ) : null}
          {banner.ctaLabel ? (
            <span className="mt-0.5 inline-flex w-fit items-center gap-0.5 rounded-sm bg-paper px-1 py-0.5 text-xs font-medium text-ink">
              {banner.ctaLabel}
              {banner.ctaHref ? (
                <Link2 className="h-2 w-2" aria-hidden />
              ) : null}
            </span>
          ) : null}
        </div>
        {banners.length > 1 ? (
          <div className="absolute bottom-1 right-1 z-10 flex items-center gap-0.5">
            {banners.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-1 rounded-full",
                  i === index ? "bg-paper" : "bg-paper/50",
                )}
              />
            ))}
          </div>
        ) : null}
        {!banner.isActive ? (
          <div className="absolute right-1 top-1 z-10">
            <Badge variant="muted">Inactive</Badge>
          </div>
        ) : null}
        {mobileView && banner.mobileImage ? (
          <div className="absolute left-1 top-1 z-10">
            <Badge variant="outline">Mobile image</Badge>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────── Banner card ───────────────────── */

interface BannerCardProps {
  index: number;
  total: number;
  banner: BannerDraft;
  isPreviewing: boolean;
  isDragTarget: boolean;
  offerSlug?: string;
  error?: Partial<Record<keyof BannerDraft, string | undefined>>;
  disabled: boolean;
  onPreview: () => void;
  onChange: (patch: Partial<BannerDraft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOnto: () => void;
}

function BannerCard({
  index,
  total,
  banner,
  isPreviewing,
  isDragTarget,
  offerSlug,
  error,
  disabled,
  onPreview,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDropOnto,
}: BannerCardProps) {
  return (
    <li
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOnto();
      }}
      onDragEnd={onDragEnd}
      onClick={onPreview}
      className={cn(
        "flex flex-col gap-1 rounded-md border bg-paper p-1.5 transition-colors",
        isDragTarget
          ? "border-ink ring-1 ring-ink"
          : isPreviewing
            ? "border-ink"
            : "border-neutral-200 hover:border-neutral-400",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-0.5 text-xs font-medium text-neutral-700">
          <span
            className="cursor-grab text-neutral-400 hover:text-ink"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-2 w-2" aria-hidden />
          </span>
          <ImageIcon className="h-2 w-2" aria-hidden />
          Banner #{index + 1}
          {!banner.isActive ? (
            <Badge variant="muted">Inactive</Badge>
          ) : null}
          {banner.fullWidth ? (
            <Badge variant="outline">Full-width</Badge>
          ) : (
            <Badge variant="outline">Contained</Badge>
          )}
        </div>
        <div
          className="flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={index === 0 || disabled}
            aria-label="Move up"
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={index === total - 1 || disabled}
            aria-label="Move down"
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove banner"
          >
            <Trash2 className="h-2 w-2" aria-hidden />
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-1 gap-1 sm:grid-cols-[120px_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thumbnail */}
        <div className="h-15 w-full overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50 sm:h-full">
          {banner.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.image}
              alt={banner.title || ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-400">
              <ImageIcon className="h-3 w-3" aria-hidden />
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-1">
          <FieldRow label="Desktop image URL" error={error?.image}>
            <Input
              invalid={!!error?.image}
              value={banner.image}
              disabled={disabled}
              onChange={(e) => onChange({ image: e.target.value })}
              placeholder="https://res.cloudinary.com/..."
            />
          </FieldRow>
          <FieldRow
            label="Mobile image (optional)"
            hint="Portrait image for phones (< 640 px). Recommended 4:3 or 9:16 ratio."
          >
            <MobileImageUpload
              value={banner.mobileImage}
              publicId={banner.mobilePublicId}
              disabled={disabled}
              onChange={(patch) => onChange(patch)}
            />
          </FieldRow>

          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <FieldRow label="Title" error={error?.title}>
              <Input
                invalid={!!error?.title}
                value={banner.title}
                disabled={disabled}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="Eid Mubarak"
              />
            </FieldRow>
            <FieldRow label="Subtitle" error={error?.subtitle}>
              <Input
                invalid={!!error?.subtitle}
                value={banner.subtitle}
                disabled={disabled}
                onChange={(e) => onChange({ subtitle: e.target.value })}
                placeholder="Up to 40% off"
              />
            </FieldRow>
            <FieldRow label="CTA label" error={error?.ctaLabel}>
              <Input
                invalid={!!error?.ctaLabel}
                value={banner.ctaLabel}
                disabled={disabled}
                onChange={(e) => onChange({ ctaLabel: e.target.value })}
                placeholder="Shop the sale"
              />
            </FieldRow>
            <FieldRow
              label="CTA link"
              error={error?.ctaHref}
              hint="Where the button takes the buyer."
            >
              <CtaLinkPicker
                value={banner.ctaHref}
                onChange={(href) => onChange({ ctaHref: href })}
                offerSlug={offerSlug}
                invalid={!!error?.ctaHref}
                disabled={disabled}
              />
            </FieldRow>
          </div>

          <div className="flex flex-wrap gap-1">
            <ToggleChip
              label="Active"
              checked={banner.isActive}
              disabled={disabled}
              onCheck={(next) => onChange({ isActive: next })}
            />
            <ToggleChip
              label="Full-width"
              checked={banner.fullWidth}
              disabled={disabled}
              icon={
                banner.fullWidth ? (
                  <Maximize2 className="h-2 w-2" aria-hidden />
                ) : (
                  <Minimize2 className="h-2 w-2" aria-hidden />
                )
              }
              onCheck={(next) => onChange({ fullWidth: next })}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

/* ───────────────────── CTA link picker ───────────────────── */

interface CtaLinkPickerProps {
  value: string;
  onChange: (next: string) => void;
  offerSlug?: string;
  invalid?: boolean;
  disabled?: boolean;
}

function CtaLinkPicker({
  value,
  onChange,
  offerSlug,
  invalid,
  disabled,
}: CtaLinkPickerProps) {
  // Keep the kind in local state; we only push the resolved URL up. This way
  // a user can flip between "Product" and "Custom URL" without losing what
  // they had typed (until they actually pick a different value).
  const [kind, setKind] = React.useState<CtaLinkKind>(() => inferCtaKind(value));

  // Keep kind in sync if the parent rewrites the href (e.g. on form reset).
  const lastValueRef = React.useRef(value);
  React.useEffect(() => {
    if (lastValueRef.current !== value) {
      lastValueRef.current = value;
      setKind(inferCtaKind(value));
    }
  }, [value]);

  function pickKind(next: string) {
    const k = next as CtaLinkKind;
    setKind(k);
    // Reset the resolved href to a sensible default for the new kind so the
    // user isn't carrying a stale product slug after switching to "Custom".
    if (k === "this-offer") {
      onChange(offerSlug ? `/offers/${offerSlug}` : "/offers");
    } else if (k === "offers-index") {
      onChange("/offers");
    } else if (k === "custom") {
      // Keep the current value if it looks like a free-form URL, otherwise
      // clear so the placeholder shows.
      if (inferCtaKind(value) !== "custom") onChange("");
    } else if (k === "product" || k === "category") {
      // Pickers populate via slug; clear so the inline search is the next thing
      // the user sees rather than a stale path.
      if (inferCtaKind(value) !== k) onChange("");
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Select
        value={kind}
        onChange={(e) => pickKind(e.target.value)}
        options={CTA_OPTIONS}
        disabled={disabled}
      />
      {kind === "custom" ? (
        <Input
          invalid={invalid}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com or /any/internal/path"
        />
      ) : kind === "product" ? (
        <ProductSlugPicker
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      ) : kind === "category" ? (
        <CategorySlugPicker
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <p className="rounded-sm border border-neutral-200 bg-neutral-50 p-1 font-mono text-[11px] text-neutral-600">
          {value || "(resolved on save)"}
        </p>
      )}
    </div>
  );
}

/* ───────────────────── Product slug picker ───────────────────── */

interface SlugPickerProps {
  value: string;
  onChange: (href: string) => void;
  disabled?: boolean;
}

function ProductSlugPicker({ value, onChange, disabled }: SlugPickerProps) {
  // Type-ahead with the admin product search. Picking writes
  // `/products/{slug}` into the href, but we display the resolved string so
  // the moderator can still hand-tweak if needed.
  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 300);
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<Array<{ slug: string; title: string }>>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!debounced.trim()) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    adminApi
      .listProducts({ q: debounced, limit: 8, sort: "newest" })
      .then((res) => {
        if (cancelled) return;
        setData(
          res.data.products.map((p) => ({ slug: p.slug, title: p.title })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setData([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="relative flex flex-col gap-0.5">
      <Input
        value={search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search products by title or sku"
      />
      {value ? (
        <p className="rounded-sm border border-neutral-200 bg-neutral-50 p-1 font-mono text-[11px] text-neutral-600">
          → {value}
        </p>
      ) : null}
      {open && (loading || data.length > 0) ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-30 overflow-y-auto rounded-sm border border-neutral-200 bg-paper shadow">
          {loading ? (
            <li className="flex items-center gap-0.5 px-1 py-0.5 text-[11px] text-neutral-500">
              <Loader2 className="h-2 w-2 animate-spin" aria-hidden />
              Searching…
            </li>
          ) : null}
          {data.map((row) => (
            <li key={row.slug}>
              <button
                type="button"
                className="block w-full truncate px-1 py-0.5 text-left text-xs hover:bg-neutral-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(`/products/${row.slug}`);
                  setSearch(row.title);
                  setOpen(false);
                }}
              >
                {row.title}
                <span className="ml-0.5 text-neutral-400">/{row.slug}</span>
              </button>
            </li>
          ))}
          {!loading && data.length === 0 ? (
            <li className="px-1 py-0.5 text-[11px] text-neutral-500">
              No matches.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/* ───────────────────── Category slug picker ───────────────────── */

function CategorySlugPicker({ value, onChange, disabled }: SlugPickerProps) {
  // Categories are small and fully active set is fine to load up-front. The
  // Select component handles its own keyboard nav.
  const [options, setOptions] = React.useState<SelectOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    catalogApi
      .listCategories({ shape: "flat", isActive: true })
      .then((cats) => {
        if (cancelled) return;
        setOptions(
          cats.map((c) => ({
            value: `/categories/${c.slug}`,
            label: c.name,
          })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-0.5">
      <Select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        options={
          loading
            ? [{ value: "", label: "Loading categories…", disabled: true }]
            : options.length > 0
              ? [{ value: "", label: "Pick a category…", disabled: true }, ...options]
              : [{ value: "", label: "No categories yet", disabled: true }]
        }
        disabled={disabled}
      />
      {value ? (
        <p className="rounded-sm border border-neutral-200 bg-neutral-50 p-1 font-mono text-[11px] text-neutral-600">
          → {value}
        </p>
      ) : null}
    </div>
  );
}

/* ───────────────────── Mobile image uploader ───────────────────── */

interface MobileImageUploadProps {
  value: string;
  publicId: string;
  onChange: (patch: { mobileImage: string; mobilePublicId: string }) => void;
  disabled?: boolean;
}

function MobileImageUpload({ value, publicId, onChange, disabled }: MobileImageUploadProps) {
  const toast = useUIStore((s) => s.toast);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 8 MB", tone: "error" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", tone: "error" });
      return;
    }
    setUploading(true);
    try {
      const sig = await uploadsApi.sign("offer");
      const result = await uploadToCloudinary(file, sig, () => {});
      onChange({ mobileImage: result.secure_url, mobilePublicId: result.public_id });
    } catch (err) {
      const message = err instanceof UploadError ? err.message : "Upload failed";
      toast({ title: "Mobile image upload failed", description: message, tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    if (publicId) {
      uploadsApi.destroy(publicId).catch(() => {});
    }
    onChange({ mobileImage: "", mobilePublicId: "" });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange({ mobileImage: e.target.value, mobilePublicId: publicId })}
          placeholder="Paste URL or upload below"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          loading={uploading}
          className="shrink-0"
        >
          {value ? "Replace" : "Upload"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled}
            aria-label="Remove mobile image"
            className="shrink-0"
          >
            <Trash2 className="h-2 w-2" aria-hidden />
          </Button>
        ) : null}
      </div>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Mobile preview"
          className="h-16 w-auto max-w-[80px] rounded-sm border border-neutral-200 object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

/* ───────────────────── Tiny primitives ───────────────────── */

interface FieldRowProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldRow({ label, hint, error, children }: FieldRowProps) {
  return (
    <Label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-neutral-700">{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] text-ink">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-neutral-500">{hint}</span>
      ) : null}
    </Label>
  );
}

interface ToggleChipProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onCheck: (next: boolean) => void;
}

function ToggleChip({ label, checked, disabled, icon, onCheck }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={() => onCheck(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border px-1 py-0.5 text-[11px] transition-colors",
        checked
          ? "border-ink bg-ink text-paper"
          : "border-neutral-300 bg-paper text-neutral-700 hover:border-ink",
        disabled && "opacity-60",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

"use client";

import * as React from "react";
import { Clipboard, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { uploadsApi, uploadToCloudinary, UploadError } from "@/lib/api/uploads";
import { useUIStore } from "@/store/uiStore";
import type { UploadScope, UploadedImage } from "@/types/uploads";
import { cn } from "@/lib/utils/cn";

export interface ImageUploaderProps {
  /** Current set of uploaded images. */
  value: UploadedImage[];
  /** Called with the next array on any add/remove/reorder/alt change. */
  onChange: (next: UploadedImage[]) => void;
  /** Cloudinary subfolder scope. Defaults to "product". */
  scope?: UploadScope;
  /** Hard cap on how many images can be uploaded. */
  max?: number;
  /** Max size in MB per file (Cloudinary's free tier caps at 10MB). */
  maxSizeMb?: number;
  /** Optional accept attribute override; defaults to images only. */
  accept?: string;
  /** Hide alt-text inputs (useful for logos / single-image cases). */
  hideAlt?: boolean;
  /** Visual label rendered above the dropzone. */
  label?: string;
  /** Helper text shown beneath the dropzone. */
  hint?: string;
  className?: string;
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

/** Pull image Files out of a DataTransfer (drag or paste). */
function extractImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/**
 * Industry-standard image uploader.
 *
 * Supports:
 *  - Drag-and-drop from the OS file system or another browser window
 *  - Click / "Choose files" picker
 *  - Ctrl+V / Cmd+V paste from clipboard (screenshots, copied images)
 *  - Paste directly into the dropzone when it is focused
 *  - Drag-to-reorder existing images with a drop-position indicator line
 *  - Per-image alt text editing inline
 *  - Individual delete with best-effort Cloudinary cleanup
 *  - Per-file progress bars and error rows for failed uploads
 *
 * Uploads go directly to Cloudinary (browser → CDN) using a short-lived
 * server-signed URL so the backend never sees the binary data.
 */
export function ImageUploader({
  value,
  onChange,
  scope = "product",
  max = 8,
  maxSizeMb = 8,
  accept = "image/*",
  hideAlt = false,
  label,
  hint,
  className,
}: ImageUploaderProps) {
  const toast = useUIStore((s) => s.toast);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);

  // Dropzone drag state - use a depth counter so moving between child
  // elements doesn't incorrectly fire dragLeave on the container.
  const [isDropTarget, setDropTarget] = React.useState(false);
  const dragDepth = React.useRef(0);

  // Row reorder drag state
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  // The gap *above* this index is the current drop target (null = none).
  const [dropAtIndex, setDropAtIndex] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Keep a ref of `value` so async upload callbacks can atomically append
  // without seeing a stale snapshot of the array.
  const valueRef = React.useRef(value);
  React.useLayoutEffect(() => {
    valueRef.current = value;
  });

  const remainingSlots = Math.max(0, max - value.length - pending.length);
  const atCapacity = remainingSlots === 0;

  // ── Stable refs so document-level handlers are registered once ──────────
  const remainingSlotsRef = React.useRef(remainingSlots);
  remainingSlotsRef.current = remainingSlots;
  const atCapacityRef = React.useRef(atCapacity);
  atCapacityRef.current = atCapacity;

  // ── Core upload function ─────────────────────────────────────────────────
  async function handleFiles(fileList: FileList | File[]) {
    if (atCapacityRef.current) {
      toast({
        title: `Maximum ${max} images`,
        description: "Remove one before uploading another.",
        tone: "info",
      });
      return;
    }

    const cap = maxSizeMb * 1024 * 1024;
    const slots = remainingSlotsRef.current;
    const okFiles: File[] = [];

    for (const f of Array.from(fileList).slice(0, slots)) {
      if (f.size > cap) {
        toast({
          title: `${f.name} is too large`,
          description: `Files must be under ${maxSizeMb} MB.`,
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
          const sig = await uploadsApi.sign(scope);
          const result = await uploadToCloudinary(p.file, sig, (pct) => {
            setPending((prev) =>
              prev.map((q) => (q.id === p.id ? { ...q, progress: pct } : q)),
            );
          });
          onChange([...valueRef.current, { url: result.secure_url, publicId: result.public_id, alt: "" }]);
        } catch (err) {
          const message = err instanceof UploadError ? err.message : "Upload failed";
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
            setPending((prev) => prev.filter((q) => q.id !== p.id || q.error));
          }, 400);
        }
      }),
    );
  }

  // Keep a stable ref so the document-level paste handler always calls the
  // latest version without needing to re-register.
  const handleFilesRef = React.useRef(handleFiles);
  React.useLayoutEffect(() => {
    handleFilesRef.current = handleFiles;
  });

  // ── Document-level paste handler (Ctrl+V / Cmd+V anywhere on page) ───────
  React.useEffect(() => {
    function onDocumentPaste(e: ClipboardEvent) {
      if (atCapacityRef.current) return;

      // Don't steal paste from focused text fields - the user may be typing.
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      const files = extractImageFiles(e.clipboardData as DataTransfer | null);
      if (files.length === 0) return;

      e.preventDefault();
      void handleFilesRef.current(files);
    }

    document.addEventListener("paste", onDocumentPaste);
    return () => document.removeEventListener("paste", onDocumentPaste);
  }, []);

  // ── Misc handlers ────────────────────────────────────────────────────────
  function handleRemove(index: number) {
    const target = value[index];
    onChange(value.filter((_, i) => i !== index));
    if (target?.publicId) {
      uploadsApi.destroy(target.publicId).catch(() => {});
    }
  }

  function handleAltChange(index: number, alt: string) {
    onChange(value.map((img, i) => (i === index ? { ...img, alt } : img)));
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to > value.length) return;
    const next = value.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    // `to` is the index AFTER removal of `from`, so adjust if needed.
    const insertAt = to > from ? to - 1 : to;
    next.splice(insertAt, 0, moved);
    onChange(next);
  }

  const onPick = () => fileInputRef.current?.click();

  // ── Dropzone paste handler (when the zone itself is focused) ─────────────
  function onDropzonePaste(e: React.ClipboardEvent) {
    if (atCapacity) return;
    const files = extractImageFiles(e.clipboardData as unknown as DataTransfer);
    if (files.length === 0) return;
    e.preventDefault();
    void handleFiles(files);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <span className="text-xs font-medium text-neutral-700">{label}</span>
      ) : null}

      {/* ── Dropzone ── */}
      <div
        role="button"
        tabIndex={atCapacity ? -1 : 0}
        aria-label="Image upload area - drag, paste or choose files"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !atCapacity) onPick();
        }}
        onPaste={onDropzonePaste}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!atCapacity && dragIndex === null) setDropTarget(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current === 0) setDropTarget(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDropTarget(false);
          if (atCapacity || dragIndex !== null) return;
          const files = extractImageFiles(e.dataTransfer);
          if (files.length) void handleFiles(files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed p-2 text-center transition-colors cursor-pointer outline-none",
          "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
          isDropTarget && !atCapacity
            ? "border-ink bg-neutral-50 scale-[1.01]"
            : "border-neutral-300 bg-paper hover:border-neutral-400 hover:bg-neutral-50",
          atCapacity && "opacity-60 cursor-not-allowed",
        )}
      >
        <ImagePlus className="h-3 w-3 text-neutral-500" aria-hidden />
        {atCapacity ? (
          <p className="text-sm text-neutral-500">Maximum {max} images reached</p>
        ) : (
          <>
            <p className="text-sm text-ink">
              Drop images here, choose files, or{" "}
              <span className="font-medium">paste</span>
            </p>
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Clipboard className="h-2 w-2" aria-hidden />
              <span>Ctrl+V / ⌘V works anywhere on this page</span>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {!atCapacity && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onPick(); }}
            tabIndex={-1}
          >
            Choose files
          </Button>
        )}
        <p className="text-[11px] text-neutral-500">
          {hint ?? `Up to ${max} images · ${maxSizeMb} MB each · JPG PNG WEBP AVIF`}
        </p>
      </div>

      {/* ── In-flight upload rows ── */}
      {pending.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 rounded-sm border border-neutral-200 bg-paper p-1 text-xs"
            >
              {p.error ? (
                <span className="shrink-0 font-bold text-ink">!</span>
              ) : (
                <Loader2 className="h-2 w-2 shrink-0 animate-spin text-neutral-500" aria-hidden />
              )}
              <span className="flex-1 min-w-0 truncate text-neutral-700">
                {p.file.name}
              </span>
              {p.error ? (
                <span className="text-[11px] text-ink">{p.error}</span>
              ) : (
                <span className="tabular-nums text-neutral-500">{p.progress}%</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Existing image rows - draggable to reorder ── */}
      {value.length > 0 && (
        <ul className="flex flex-col gap-0">
          {value.map((img, i) => (
            <React.Fragment key={`${img.url}-${i}`}>
              {/* Drop indicator line above this row */}
              <li
                aria-hidden
                onDragOver={(e) => { e.preventDefault(); setDropAtIndex(i); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                  setDropAtIndex(null);
                }}
                className={cn(
                  "h-0.5 rounded-full transition-all duration-100",
                  dropAtIndex === i && dragIndex !== null && dragIndex !== i
                    ? "bg-ink my-0.5"
                    : "bg-transparent",
                )}
              />

              {/* Image row */}
              <li
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  // Ghost image is just the thumbnail
                  const thumb = e.currentTarget.querySelector("img");
                  if (thumb) e.dataTransfer.setDragImage(thumb, 20, 20);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropAtIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                  setDropAtIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropAtIndex(null);
                  setDropTarget(false);
                  dragDepth.current = 0;
                }}
                className={cn(
                  "flex items-center gap-1 rounded-sm border bg-paper p-1 transition-opacity",
                  dragIndex === i
                    ? "opacity-40 border-neutral-300"
                    : "border-neutral-200 opacity-100",
                )}
              >
                {/* Drag handle */}
                <span
                  className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-ink shrink-0 touch-none"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-2 w-2" aria-hidden />
                </span>

                {/* Thumbnail */}
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </div>

                {/* Alt text / URL */}
                <div className="flex-1 min-w-0">
                  {hideAlt ? (
                    <p className="truncate text-xs text-neutral-500">{img.url}</p>
                  ) : (
                    <Input
                      type="text"
                      value={img.alt ?? ""}
                      onChange={(e) => handleAltChange(i, e.target.value)}
                      placeholder="Alt text (optional - helps SEO & accessibility)"
                    />
                  )}
                  {i === 0 && (
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      Primary image - shown on product cards
                    </p>
                  )}
                </div>

                {/* Remove */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="shrink-0"
                >
                  <Trash2 className="h-2 w-2" aria-hidden />
                </Button>
              </li>
            </React.Fragment>
          ))}

          {/* Drop indicator at the very bottom */}
          <li
            aria-hidden
            onDragOver={(e) => { e.preventDefault(); setDropAtIndex(value.length); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragIndex !== null) reorder(dragIndex, value.length);
              setDragIndex(null);
              setDropAtIndex(null);
            }}
            className={cn(
              "h-0.5 rounded-full transition-all duration-100",
              dropAtIndex === value.length && dragIndex !== null
                ? "bg-ink mt-0.5"
                : "bg-transparent",
            )}
          />
        </ul>
      )}
    </div>
  );
}

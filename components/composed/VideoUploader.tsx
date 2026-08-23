"use client";

import * as React from "react";
import { Film, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { uploadsApi, uploadToCloudinary, UploadError } from "@/lib/api/uploads";
import { useUIStore } from "@/store/uiStore";
import type { UploadScope, UploadedVideo } from "@/types/uploads";
import { cn } from "@/lib/utils/cn";

export interface VideoUploaderProps {
  /** The current video, or null when none is set. */
  value: UploadedVideo | null;
  /** Called with the new video after upload, or null on remove. */
  onChange: (next: UploadedVideo | null) => void;
  /** Cloudinary subfolder scope. Defaults to "product". */
  scope?: UploadScope;
  /** Max size in MB (Cloudinary free tier caps video at 100MB). */
  maxSizeMb?: number;
  /** Visual label rendered above the dropzone. */
  label?: string;
  /** Helper text shown beneath the dropzone. */
  hint?: string;
  className?: string;
}

/**
 * Derive a poster (thumbnail) URL from a Cloudinary video URL: grab the
 * first frame (`so_0`) as a jpg. Falls back to undefined for non-Cloudinary
 * URLs so the <video> element just shows its own first frame.
 */
function derivePosterUrl(videoUrl: string): string | undefined {
  if (!videoUrl.includes("/video/upload/")) return undefined;
  return videoUrl
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.[a-z0-9]+$/i, ".jpg");
}

/**
 * Single-video uploader (browser → Cloudinary direct, same signed flow as
 * ImageUploader). One video per product: uploading a new one replaces the
 * old, and removal best-effort deletes the asset from Cloudinary.
 */
export function VideoUploader({
  value,
  onChange,
  scope = "product",
  maxSizeMb = 100,
  label,
  hint,
  className,
}: VideoUploaderProps) {
  const toast = useUIStore((s) => s.toast);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [isDropTarget, setDropTarget] = React.useState(false);
  const dragDepth = React.useRef(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploading = progress !== null;

  async function handleFile(file: File) {
    if (uploading) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: `${file.name} isn't a video`, tone: "error" });
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast({
        title: `${file.name} is too large`,
        description: `Videos must be under ${maxSizeMb} MB.`,
        tone: "error",
      });
      return;
    }

    const previous = value;
    setProgress(0);
    try {
      const sig = await uploadsApi.sign(scope, "video");
      const result = await uploadToCloudinary(file, sig, setProgress);
      onChange({
        url: result.secure_url,
        publicId: result.public_id,
        posterUrl: derivePosterUrl(result.secure_url),
        duration: result.duration,
      });
      // Replacing? Clean up the old asset best-effort.
      if (previous?.publicId && previous.publicId !== result.public_id) {
        uploadsApi.destroy(previous.publicId, "video").catch(() => {});
      }
    } catch (err) {
      const message = err instanceof UploadError ? err.message : "Upload failed";
      toast({ title: "Couldn't upload video", description: message, tone: "error" });
    } finally {
      setProgress(null);
    }
  }

  function handleRemove() {
    const target = value;
    onChange(null);
    if (target?.publicId) {
      uploadsApi.destroy(target.publicId, "video").catch(() => {});
    }
  }

  const onPick = () => fileInputRef.current?.click();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <span className="text-xs font-medium text-neutral-700">{label}</span>
      ) : null}

      {value && !uploading ? (
        /* ── Current video preview ── */
        <div className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-paper p-1 sm:flex-row sm:items-center">
          <video
            src={value.url}
            poster={value.posterUrl}
            controls
            preload="metadata"
            playsInline
            className="max-h-[180px] w-full rounded-sm bg-neutral-900 sm:w-[240px]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5">
            <p className="truncate text-xs text-neutral-500">{value.url}</p>
            {typeof value.duration === "number" && value.duration > 0 ? (
              <p className="text-[11px] text-neutral-400">
                {Math.floor(value.duration / 60)}:
                {String(Math.round(value.duration % 60)).padStart(2, "0")} min
              </p>
            ) : null}
            <div className="mt-0.5 flex items-center gap-1">
              <Button type="button" variant="secondary" size="sm" onClick={onPick}>
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                aria-label="Remove video"
              >
                <Trash2 className="h-2 w-2" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Dropzone / progress ── */
        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label="Video upload area - drag a video here or choose a file"
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) onPick();
          }}
          onClick={() => !uploading && onPick()}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            if (!uploading) setDropTarget(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current === 0) setDropTarget(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDropTarget(false);
            if (uploading) return;
            const file = Array.from(e.dataTransfer.files).find((f) =>
              f.type.startsWith("video/"),
            );
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed p-2 text-center transition-colors cursor-pointer outline-none",
            "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
            isDropTarget && !uploading
              ? "border-ink bg-neutral-50 scale-[1.01]"
              : "border-neutral-300 bg-paper hover:border-neutral-400 hover:bg-neutral-50",
            uploading && "cursor-progress",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-neutral-500" aria-hidden />
              <p className="text-sm text-ink">Uploading… {progress}%</p>
              <div className="h-[4px] w-full max-w-[240px] overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-ink transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Film className="h-3 w-3 text-neutral-500" aria-hidden />
              <p className="text-sm text-ink">
                Drop a video here or <span className="font-medium">choose a file</span>
              </p>
              <p className="text-[11px] text-neutral-500">
                {hint ?? `One video · up to ${maxSizeMb} MB · MP4 WEBM MOV`}
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

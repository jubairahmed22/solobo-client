"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface FormStickyBarProps {
  mode?: "create" | "edit";
  isDirty: boolean;
  isSubmitting: boolean;
  submitLabel?: string;
  onDiscard?: () => void;
}

export function FormStickyBar({
  mode = "edit",
  isDirty,
  isSubmitting,
  submitLabel,
  onDiscard,
}: FormStickyBarProps) {
  const isCreate = mode === "create";
  const saved = !isDirty && !isSubmitting && !isCreate;

  const status = isSubmitting
    ? isCreate
      ? "Creating…"
      : "Saving…"
    : isDirty
      ? "Unsaved changes"
      : isCreate
        ? "Fill in the details above, then publish."
        : "All changes saved";

  const label = submitLabel ?? (isCreate ? "Publish" : "Save changes");

  return (
    <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
      {/* Status indicator */}
      <div className="flex min-w-0 items-center gap-2">
        {saved ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
        ) : isDirty && !isSubmitting ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
        ) : null}
        <p className="truncate text-[12.5px] text-neutral-500">{status}</p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {onDiscard && isDirty && !isSubmitting && (
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-neutral-200 bg-paper px-3 text-[12.5px] font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-ink"
          >
            Discard
          </button>
        )}
        <button
          type="submit"
          disabled={(!isDirty && !isCreate) || isSubmitting}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[12.5px] font-semibold transition-all duration-150",
            "bg-ink text-paper hover:bg-neutral-800",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : isCreate ? (
            <Plus className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden />
          )}
          {label}
        </button>
      </div>
    </div>
  );
}

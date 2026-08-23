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
    <div className="flex items-center justify-between gap-[16px] border-t border-gray-200 pt-[16px]">
      {/* Status indicator */}
      <div className="flex min-w-0 items-center gap-[8px]">
        {saved ? (
          <CheckCircle2 className="h-[16px] w-[16px] shrink-0 text-green-500" aria-hidden />
        ) : isDirty && !isSubmitting ? (
          <span className="h-[8px] w-[8px] shrink-0 rounded-full bg-yellow-400" aria-hidden />
        ) : null}
        <p className="truncate text-[14px] text-gray-500">{status}</p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-[8px]">
        {onDiscard && isDirty && !isSubmitting && (
          /* Flowbite alternative button */
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[16px] text-[14px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
          >
            Discard
          </button>
        )}
        {/* Flowbite primary button */}
        <button
          type="submit"
          disabled={(!isDirty && !isCreate) || isSubmitting}
          className={cn(
            "inline-flex h-[40px] items-center gap-[8px] rounded-[8px] px-[20px] text-[14px] font-medium transition duration-75",
            "bg-[#1A56DB] text-white hover:bg-[#1E429F]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-[16px] w-[16px] animate-spin" aria-hidden />
          ) : isCreate ? (
            <Plus className="h-[16px] w-[16px]" aria-hidden />
          ) : (
            <Save className="h-[16px] w-[16px]" aria-hidden />
          )}
          {label}
        </button>
      </div>
    </div>
  );
}

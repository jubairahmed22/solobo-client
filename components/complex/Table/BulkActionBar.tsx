"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface BulkActionBarProps {
  /** Number of rows currently selected. Bar shows when > 0. */
  count: number;
  onClear: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Floating bar that appears at the bottom of the screen when rows are selected.
 * Wrap action buttons inside as children. Black bar, white text - keeps the b/w spec.
 */
export function BulkActionBar({ count, onClear, children, className }: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed inset-x-2 bottom-2 z-30 mx-auto flex max-w-3xl items-center justify-between gap-2 rounded-md bg-ink px-2.5 py-1.5 text-paper shadow-lg sm:inset-x-3 sm:bottom-3",
            className,
          )}
          role="region"
          aria-label="Bulk actions"
        >
          <div className="flex items-center gap-1.5">
            <span className="rounded-sm bg-paper/15 px-1 py-0.5 text-xs font-medium">
              {count}
            </span>
            <span className="text-sm">selected</span>
          </div>
          <div className="flex items-center gap-1">
            {children}
            <button
              type="button"
              onClick={onClear}
              className="rounded-sm px-1.5 py-0.5 text-sm text-paper/80 hover:text-paper"
            >
              Clear
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

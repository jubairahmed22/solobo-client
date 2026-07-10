"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useEscape } from "@/hooks/useEscape";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Show the close (X) button in the corner. Default true. */
  showClose?: boolean;
  /** Disable closing on backdrop click. */
  staticBackdrop?: boolean;
  className?: string;
}

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  showClose = true,
  staticBackdrop = false,
  className,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  useEscape(onClose, open);

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
        >
          <motion.div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!staticBackdrop) onClose();
            }}
          />
          <motion.div
            className={cn(
              "relative z-10 w-full overflow-hidden rounded-t-2xl bg-paper shadow-xl md:rounded-2xl",
              SIZE[size],
              className,
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {(title || showClose) && (
              <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3.5">
                <div className="flex flex-col gap-1">
                  {title ? (
                    <h2 id="modal-title" className="text-base font-semibold text-ink">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="text-sm text-neutral-600">{description}</p>
                  ) : null}
                </div>
                {showClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-[8px] -mt-[4px] inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
                  >
                    <X className="h-[20px] w-[20px]" aria-hidden />
                  </button>
                ) : null}
              </header>
            )}
            <div className="px-4 py-4">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

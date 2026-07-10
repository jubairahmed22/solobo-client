"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useEscape } from "@/hooks/useEscape";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right" | "bottom";
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind width class for left/right drawers. Default w-[88vw] sm:w-96. */
  widthClassName?: string;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
  widthClassName = "w-[88vw] sm:w-96",
  className,
}: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  useEscape(onClose, open);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted) return null;

  const isBottom = side === "bottom";
  const initial = isBottom ? { y: "100%" } : { x: side === "right" ? "100%" : "-100%" };
  const animateTo = isBottom ? { y: 0 } : { x: 0 };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "drawer-title" : undefined}
        >
          <motion.div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            initial={initial}
            animate={animateTo}
            exit={initial}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "z-10 flex flex-col bg-paper shadow-xl",
              isBottom
                ? "absolute inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl"
                : cn(
                    "relative h-full",
                    widthClassName,
                    side === "right" ? "ml-auto" : "mr-auto",
                  ),
              className,
            )}
          >
            {/* Drag handle for bottom sheet */}
            {isBottom ? (
              <div className="flex shrink-0 justify-center pb-1 pt-3">
                <div className="h-1 w-10 rounded-full bg-neutral-300" />
              </div>
            ) : null}

            {/* NOTE: this project's Tailwind spacing scale is 8px per unit
                (h-5 = 40px), so icon/hit-target sizes use explicit px values. */}
            {title ? (
              <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-[16px] py-[10px]">
                <h2 id="drawer-title" className="text-base font-semibold text-ink">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-[8px] inline-flex h-[36px] w-[36px] items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  <X className="h-[20px] w-[20px]" aria-hidden />
                </button>
              </header>
            ) : null}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

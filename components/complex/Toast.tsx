"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore, type ToastTone } from "@/store/uiStore";

const ICONS: Record<ToastTone, React.ReactNode> = {
  default: null,
  success: <CheckCircle2 className="h-[18px] w-[18px] shrink-0" aria-hidden />,
  error: <AlertCircle className="h-[18px] w-[18px] shrink-0" aria-hidden />,
  info: <Info className="h-[18px] w-[18px] shrink-0" aria-hidden />,
};

const TONE_STYLES: Record<ToastTone, string> = {
  default: "bg-ink text-paper",
  success: "bg-ink text-paper",
  error: "bg-paper text-ink border border-ink",
  info: "bg-paper text-ink border border-neutral-300",
};

/**
 * Toaster - render once at app root. Reads from the global uiStore queue.
 * Use `useUIStore.getState().toast({ title, tone })` from anywhere to push.
 */
export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-[72px] right-3 z-50 flex w-full max-w-sm flex-col gap-2 px-3 sm:bottom-5 sm:right-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl px-3 py-3 shadow-lg",
              TONE_STYLES[t.tone],
            )}
            role={t.tone === "error" ? "alert" : "status"}
          >
            {ICONS[t.tone]}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-sm opacity-80">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-[4px] -mt-[4px] inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-[16px] w-[16px]" aria-hidden />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

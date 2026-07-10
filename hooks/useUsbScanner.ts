"use client";

import * as React from "react";

export interface UseUsbScannerOptions {
  onScan: (code: string) => void;
  /** Time in ms between keystrokes to distinguish scanner from human. Default 60. */
  threshold?: number;
  /** Minimum length to consider a valid scan. Default 3. */
  minLength?: number;
  /** Element to attach listeners to (default: window). Pass null to disable. */
  target?: EventTarget | null;
}

/**
 * Detects USB/Bluetooth barcode scanners operating in keyboard-wedge mode.
 * Scanners emit keystrokes very rapidly (each char < threshold ms apart)
 * and always terminate with Enter. This hook captures those bursts and calls
 * onScan with the accumulated code, preventing the Enter from being processed
 * as a form submission.
 */
export function useUsbScanner({
  onScan,
  threshold = 60,
  minLength = 3,
  target,
}: UseUsbScannerOptions) {
  const bufferRef = React.useRef<string>("");
  const lastKeyTimeRef = React.useRef<number>(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const el: EventTarget = target === undefined ? window : (target ?? window);
    if (!el) return;

    const handleKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;

      // If this is Enter, decide what to do
      if (ke.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (code.length >= minLength) {
          ke.preventDefault();
          ke.stopPropagation();
          onScan(code);
        }
        return;
      }

      // Ignore non-printable keys
      if (ke.key.length !== 1) {
        bufferRef.current = "";
        return;
      }

      // If gap is too large, reset buffer (human typing, not a scanner)
      if (bufferRef.current && gap > threshold) {
        bufferRef.current = "";
      }

      bufferRef.current += ke.key;
      lastKeyTimeRef.current = now;

      // Auto-clear stale buffer after 2× threshold
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = "";
      }, threshold * 2);
    };

    el.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      el.removeEventListener("keydown", handleKeyDown, { capture: true });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onScan, threshold, minLength, target]);
}

"use client";

import * as React from "react";
import { Camera, X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ── BarcodeDetector type augmentation ── */
// BarcodeDetector is a native browser API (Chrome/Edge 83+).
// It's not in TypeScript's default lib - declare it minimally.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas): Promise<DetectedBarcode[]>;
  static getSupportedFormats(): Promise<string[]>;
}

export interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string, format: string) => void;
  /** Hint text shown below the viewfinder */
  prompt?: string;
}

/**
 * Camera barcode scanner using the native BarcodeDetector API.
 * Supported in Chromium-based browsers. Shows a graceful fallback for others.
 */
export function BarcodeScanner({
  open,
  onClose,
  onScan,
  prompt = "Point camera at a barcode",
}: BarcodeScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number>(0);
  const lastCodeRef = React.useRef<string>("");
  const lastCodeTimeRef = React.useRef<number>(0);

  const [status, setStatus] = React.useState<"idle" | "loading" | "active" | "error" | "unsupported">("idle");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [lastScan, setLastScan] = React.useState<string>("");

  const isSupported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stopCamera = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = React.useCallback(async () => {
    if (!isSupported) { setStatus("unsupported"); return; }
    setStatus("loading");
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("active");

      const detector = new BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "pdf417", "data_matrix"],
      });

      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const { rawValue, format } = barcodes[0]!;
            const now = Date.now();
            // Debounce same code to avoid duplicate fires
            if (rawValue !== lastCodeRef.current || now - lastCodeTimeRef.current > 2000) {
              lastCodeRef.current = rawValue;
              lastCodeTimeRef.current = now;
              setLastScan(rawValue);
              onScan(rawValue, format);
            }
          }
        } catch {
          // Suppress per-frame detection errors
        }
        rafRef.current = requestAnimationFrame(scan);
      };

      rafRef.current = requestAnimationFrame(scan);
    } catch (err) {
      setStatus("error");
      const e = err as { name?: string };
      if (e.name === "NotAllowedError") {
        setErrorMsg("Camera permission denied. Allow access in browser settings.");
      } else if (e.name === "NotFoundError") {
        setErrorMsg("No camera found on this device.");
      } else {
        setErrorMsg("Could not access the camera.");
      }
    }
  }, [isSupported, onScan]);

  React.useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setStatus("idle");
      setLastScan("");
    }
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Barcode scanner"
      aria-modal
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex w-full max-w-sm flex-col gap-3 overflow-hidden rounded-2xl bg-ink text-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-accent" aria-hidden />
            <span className="text-sm font-semibold">Scan Barcode</span>
          </div>
          <button
            type="button"
            aria-label="Close scanner"
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative mx-5 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "4/3" }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn(
              "h-full w-full object-cover",
              status !== "active" && "invisible",
            )}
          />

          {/* Scanning overlay - crosshair guide */}
          {status === "active" && (
            <>
              {/* Dark edges */}
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-1 bg-black/40" />
                <div className="flex h-2/5 min-h-[100px]">
                  <div className="w-[12%] bg-black/40" />
                  <div className="flex-1" />
                  <div className="w-[12%] bg-black/40" />
                </div>
                <div className="flex-1 bg-black/40" />
              </div>
              {/* Corner brackets */}
              <div className="pointer-events-none absolute left-[12%] top-[30%]">
                <div className="h-5 w-5 border-l-2 border-t-2 border-accent" />
              </div>
              <div className="pointer-events-none absolute right-[12%] top-[30%]">
                <div className="h-5 w-5 border-r-2 border-t-2 border-accent" />
              </div>
              <div className="pointer-events-none absolute bottom-[30%] left-[12%]">
                <div className="h-5 w-5 border-b-2 border-l-2 border-accent" />
              </div>
              <div className="pointer-events-none absolute bottom-[30%] right-[12%]">
                <div className="h-5 w-5 border-b-2 border-r-2 border-accent" />
              </div>
              {/* Scanning line */}
              <div className="pointer-events-none absolute left-[12%] right-[12%] top-1/2 h-px -translate-y-1/2 animate-scan bg-accent/60" />
            </>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <span className="text-xs text-white/70">Starting camera…</span>
            </div>
          )}

          {/* Error / unsupported */}
          {(status === "error" || status === "unsupported") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-accent" aria-hidden />
              <span className="text-sm font-semibold text-white">
                {status === "unsupported" ? "Camera scanning not supported" : "Camera error"}
              </span>
              <span className="text-xs text-white/60 leading-relaxed">
                {status === "unsupported"
                  ? "Use Chrome or Edge for camera scanning. You can still use a USB scanner."
                  : errorMsg}
              </span>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-2 px-5 pb-5">
          <p className="text-center text-xs text-white/60">{prompt}</p>
          {lastScan ? (
            <div className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
              <span className="flex-1 truncate text-xs font-mono text-white/90">{lastScan}</span>
              <span className="shrink-0 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                detected
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* Add scanning line animation to globals if not already present */
// globals.css needs: @keyframes scan { 0%,100%{top:30%} 50%{top:70%} }
// .animate-scan { animation: scan 2s ease-in-out infinite; }
// This is added via the tailwind config or direct CSS.

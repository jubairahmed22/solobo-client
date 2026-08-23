"use client";

import * as React from "react";
import { Copy, Download, Printer, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { renderSymbology } from "@/lib/labels/engine";
import type { Symbology } from "@/lib/labels/types";

export interface BarcodeTagProps {
  /** The value to encode */
  value: string;
  format?: Symbology;
  /** Display label below the barcode (defaults to value) */
  label?: string;
  /** Size in px of the rendered barcode element */
  width?: number;
  height?: number;
  /** EAN13/UPCA/EAN8 only - 80-200. */
  magnificationPct?: number;
  /** QR only. */
  eclevel?: "L" | "M" | "Q" | "H";
  showActions?: boolean;
  className?: string;
}

/** Strip the engine's explicit mm width/height for on-screen preview - the container's CSS width + the SVG's own viewBox drive the visual size instead, so the same markup scales cleanly at any preview size. Print/export paths use the full (unstripped) SVG from renderSymbology directly. */
function stripExplicitSize(svg: string): string {
  return svg.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "");
}

export function BarcodeTag({
  value,
  format = "CODE128",
  label,
  width = 200,
  height = 70,
  magnificationPct,
  eclevel,
  showActions = true,
  className,
}: BarcodeTagProps) {
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!value) {
      setSvg("");
      setError("");
      return;
    }
    let cancelled = false;
    renderSymbology({
      value,
      symbology: format,
      heightMM: format === "QR" || format === "DATAMATRIX" ? undefined : height / 3.78, // px -> mm @ 96dpi, only used as a fallback default for non-magnified symbologies
      magnificationPct,
      eclevel,
    })
      .then((result) => {
        if (cancelled) return;
        setSvg(result.svg);
        setError("");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setSvg("");
        setError(err.message || "Invalid barcode value for format");
      });
    return () => {
      cancelled = true;
    };
  }, [value, format, height, magnificationPct, eclevel]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${value}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!svg) return;
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return;
    win.document.write(`<html><body style="text-align:center;font-family:Arial">${svg}<p>${label ?? value}</p></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  return (
    <div className={cn("inline-flex max-w-full flex-col items-center gap-1.5", className)}>
      <div className="max-w-full rounded-lg border border-neutral-200 bg-white p-2">
        {error ? (
          <div
            className="flex w-full max-w-[200px] items-center justify-center rounded bg-neutral-50 text-xs text-neutral-500"
            style={{ height }}
          >
            {error}
          </div>
        ) : svg ? (
          <div
            style={{ width }}
            className="block h-auto max-w-full [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            aria-label={label ?? value}
            dangerouslySetInnerHTML={{ __html: stripExplicitSize(svg) }}
          />
        ) : (
          <div className="aspect-square max-w-full animate-pulse rounded bg-neutral-100" style={{ width }} />
        )}
      </div>

      {(label !== undefined || format !== "QR") && (
        <span className="max-w-full truncate text-center text-[10px] font-mono text-neutral-600">
          {label ?? value}
        </span>
      )}

      {showActions && (
        <div className="flex items-center gap-1">
          <ActionBtn onClick={handleCopy} label={copied ? "Copied!" : "Copy value"}>
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </ActionBtn>
          <ActionBtn onClick={handleDownload} label="Download SVG">
            <Download className="h-3 w-3" />
          </ActionBtn>
          <ActionBtn onClick={handlePrint} label="Print">
            <Printer className="h-3 w-3" />
          </ActionBtn>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink"
    >
      {children}
    </button>
  );
}

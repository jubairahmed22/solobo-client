"use client";

import * as React from "react";
import { Copy, Download, Printer, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { BarcodeFormat } from "@/lib/barcode";

export interface BarcodeTagProps {
  /** The value to encode */
  value: string;
  format?: BarcodeFormat;
  /** Display label below the barcode (defaults to value) */
  label?: string;
  /** Size in px of the rendered barcode element */
  width?: number;
  height?: number;
  showActions?: boolean;
  className?: string;
}

export function BarcodeTag({
  value,
  format = "CODE128",
  label,
  width = 200,
  height = 70,
  showActions = true,
  className,
}: BarcodeTagProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [qrUrl, setQrUrl] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  const isQr = format === "QR";

  // Render linear barcode
  React.useEffect(() => {
    if (isQr || !svgRef.current || !value) return;
    let cancelled = false;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (cancelled || !svgRef.current) return;
      try {
        JsBarcode(svgRef.current, value, {
          format: format === "UPCA" ? "UPC" : format,
          width: 1.5,
          height,
          displayValue: true,
          fontSize: 11,
          margin: 6,
          background: "#ffffff",
          lineColor: "#0A0A0A",
          textMargin: 3,
        });
        setError("");
      } catch {
        setError("Invalid barcode value for format");
      }
    });
    return () => { cancelled = true; };
  }, [value, format, height, isQr]);

  // Render QR code
  React.useEffect(() => {
    if (!isQr || !value) return;
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      if (cancelled) return;
      QRCode.toDataURL(value, { width, margin: 1, errorCorrectionLevel: "M" })
        .then((url) => { if (!cancelled) { setQrUrl(url); setError(""); } })
        .catch(() => { if (!cancelled) setError("Failed to generate QR code"); });
    });
    return () => { cancelled = true; };
  }, [value, isQr, width]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (isQr && qrUrl) {
      const a = document.createElement("a");
      a.href = qrUrl;
      a.download = `${value}.png`;
      a.click();
      return;
    }
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${value}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return;
    if (isQr && qrUrl) {
      win.document.write(`<html><body style="text-align:center;font-family:Arial"><img src="${qrUrl}" /><p>${label ?? value}</p></body></html>`);
    } else if (svgRef.current) {
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      win.document.write(`<html><body style="text-align:center;font-family:Arial">${xml}</body></html>`);
    }
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div className="rounded-lg border border-neutral-200 bg-white p-2">
        {error ? (
          <div className="flex h-[70px] w-[200px] items-center justify-center rounded bg-neutral-50 text-xs text-neutral-500">
            {error}
          </div>
        ) : isQr ? (
          qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt={label ?? value} width={width} height={width} className="block" />
          ) : (
            <div className="h-[200px] w-[200px] animate-pulse rounded bg-neutral-100" />
          )
        ) : (
          <svg ref={svgRef} aria-label={label ?? value} />
        )}
      </div>

      {(label !== undefined || !isQr) && (
        <span className="max-w-[200px] truncate text-center text-[10px] font-mono text-neutral-600">
          {label ?? value}
        </span>
      )}

      {showActions && (
        <div className="flex items-center gap-1">
          <ActionBtn onClick={handleCopy} label={copied ? "Copied!" : "Copy value"}>
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </ActionBtn>
          <ActionBtn onClick={handleDownload} label="Download">
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

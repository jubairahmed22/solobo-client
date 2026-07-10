"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LABEL_SIZES, buildSheetHtml, printHtml, type LabelData, type LabelSize } from "@/lib/barcode";

export interface LabelSheetProps {
  labels: LabelData[];
  /** Pre-selected label size id */
  defaultSizeId?: string;
  className?: string;
}

/**
 * Preview and print a sheet of labels.
 * Renders scaled-down previews on screen; actual print uses @page CSS at real mm sizes.
 */
export function LabelSheet({ labels, defaultSizeId = "sm", className }: LabelSheetProps) {
  const [sizeId, setSizeId] = React.useState(defaultSizeId);
  const [printing, setPrinting] = React.useState(false);

  const size: LabelSize = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[1]!;

  const handlePrint = async () => {
    setPrinting(true);
    // Build SVGs client-side for all labels before printing
    const enriched = await enrichLabels(labels, size);
    const html = buildSheetHtml(enriched, size);
    printHtml(html);
    setTimeout(() => setPrinting(false), 1000);
  };

  if (labels.length === 0) return null;

  // Scale factor: show labels at ~2× their mm size in px for preview
  const SCALE = 2.5;
  const previewW = size.widthMM * SCALE;
  const previewH = size.heightMM * SCALE;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          Label size:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LABEL_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSizeId(s.id)}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs transition-colors",
                sizeId === s.id
                  ? "border-ink bg-ink text-paper"
                  : "border-neutral-300 text-neutral-600 hover:border-ink hover:text-ink",
              )}
            >
              <span className="font-semibold">{s.label}</span>
              <span className="ml-1 text-neutral-400">{s.note}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="ml-auto flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-neutral-800 disabled:opacity-60"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          {printing ? "Preparing…" : `Print ${labels.length} label${labels.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* Preview grid */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        {labels.slice(0, 12).map((label, i) => (
          <LabelPreview key={i} label={label} size={size} previewW={previewW} previewH={previewH} />
        ))}
        {labels.length > 12 && (
          <div
            style={{ width: previewW, height: previewH }}
            className="flex items-center justify-center rounded-md border border-dashed border-neutral-300 text-xs text-neutral-400"
          >
            +{labels.length - 12} more
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        {labels.length} label{labels.length !== 1 ? "s" : ""} ·{" "}
        {size.label} ({size.widthMM}×{size.heightMM}mm) ·{" "}
        Dashed borders are cut guides, not printed
      </p>
    </div>
  );
}

/* ─── Per-label preview ─── */

function LabelPreview({
  label,
  size,
  previewW,
  previewH,
}: {
  label: LabelData;
  size: LabelSize;
  previewW: number;
  previewH: number;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [qrUrl, setQrUrl] = React.useState("");

  React.useEffect(() => {
    if (label.format === "QR") {
      import("qrcode").then((QRCode) =>
        QRCode.toDataURL(label.barcode, { width: previewW, margin: 1 }).then(setQrUrl),
      );
      return;
    }
    if (!svgRef.current) return;
    let cancelled = false;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (cancelled || !svgRef.current) return;
      try {
        JsBarcode(svgRef.current, label.barcode, {
          format: label.format === "UPCA" ? "UPC" : label.format,
          width: 1,
          height: Math.max(previewH * 0.4, 12),
          displayValue: true,
          fontSize: 6,
          margin: 2,
          background: "#fff",
          lineColor: "#0A0A0A",
          textMargin: 1,
        });
      } catch { /* ignore invalid combos */ }
    });
    return () => { cancelled = true; };
  }, [label, previewW, previewH]);

  return (
    <div
      style={{ width: previewW, height: previewH }}
      className="flex flex-col items-center justify-between overflow-hidden rounded-md border border-dashed border-neutral-300 bg-white p-1"
    >
      <p
        className="w-full truncate text-center font-bold text-neutral-900"
        style={{ fontSize: Math.max(previewW / 22, 7) }}
      >
        {label.title}
      </p>
      {label.format === "QR" ? (
        qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt={label.barcode} style={{ maxHeight: previewH * 0.6 }} />
        ) : (
          <div className="flex-1 animate-pulse bg-neutral-100 rounded" style={{ width: previewW * 0.5, height: previewW * 0.5 }} />
        )
      ) : (
        <svg ref={svgRef} style={{ maxWidth: "100%", height: "auto" }} />
      )}
      {label.sku ? (
        <p className="truncate text-neutral-500" style={{ fontSize: Math.max(previewW / 28, 5.5) }}>
          {label.sku}
        </p>
      ) : null}
      {label.price ? (
        <p className="font-bold text-neutral-900" style={{ fontSize: Math.max(previewW / 22, 6) }}>
          {label.price}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Helpers ─── */

async function enrichLabels(labels: LabelData[], size: LabelSize): Promise<LabelData[]> {
  return Promise.all(
    labels.map(async (label): Promise<LabelData> => {
      if (label.format === "QR") {
        const QRCode = await import("qrcode");
        const qrDataUrl = await QRCode.toDataURL(label.barcode, { width: size.widthMM * 3, margin: 1 });
        return { ...label, qrDataUrl };
      }

      // Render barcode to SVG string
      const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const { default: JsBarcode } = await import("jsbarcode");
      try {
        JsBarcode(svgEl, label.barcode, {
          format: label.format === "UPCA" ? "UPC" : label.format,
          width: 1.5,
          height: Math.max(size.heightMM * 2, 30),
          displayValue: true,
          fontSize: 8,
          margin: 4,
          background: "#ffffff",
          lineColor: "#0A0A0A",
          textMargin: 2,
        });
      } catch { /* invalid combo */ }
      return { ...label, svgString: svgEl.outerHTML };
    }),
  );
}

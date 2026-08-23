/**
 * Barcode utilities - thin backward-compat facade over lib/labels/*, the
 * unified label/barcode engine (bwip-js based). Check-digit validation,
 * format metadata and detection now live in lib/labels/{validation,formats,
 * types}.ts; this file just re-exports them under their original names so
 * existing call sites don't need to change.
 *
 * `LABEL_SIZES`/`LabelData`/`LabelSize`/`buildLabelHtml`/`buildSheetHtml`
 * below are @deprecated - they predate the LabelTemplate/SheetLayout model
 * (lib/labels/types.ts) and use flex-wrap positioning rather than real
 * Avery-grid mm coordinates. Superseded by `buildTemplateLabelHtml`/
 * `buildTemplateSheetHtml` (lib/labels/print.ts, added when the template
 * model lands). Kept working until every call site migrates.
 */

export type { Symbology as BarcodeFormat } from "./labels/types";
export type { FormatMeta } from "./labels/formats";
export { BARCODE_FORMATS, getFormatMeta } from "./labels/formats";
export { isValidEAN13, isValidUPCA, isValidEAN8, isValidITF14, detectFormat } from "./labels/validation";
export { printHtml } from "./labels/print";

/* ─────────────── Label sizes (deprecated - see module docs) ─────────────── */

export interface LabelSize {
  id: string;
  label: string;
  widthMM: number;
  heightMM: number;
  note: string;
}

export const LABEL_SIZES: LabelSize[] = [
  { id: "xs",       label: '1.25" × 0.75"',  widthMM: 32,  heightMM: 19,  note: "Jewelry / small items" },
  { id: "sm",       label: '2" × 1"',          widthMM: 50,  heightMM: 25,  note: "Standard retail tag" },
  { id: "md",       label: '3" × 1.5"',        widthMM: 76,  heightMM: 38,  note: "Apparel hang tag" },
  { id: "lg",       label: '4" × 2"',          widthMM: 100, heightMM: 50,  note: "Box / product label" },
  { id: "shipping", label: '4" × 6"',          widthMM: 100, heightMM: 150, note: "Shipping label" },
];

/* ─────────────── SKU / barcode generation ─────────────── */

/** Generate a unique Code128-safe barcode from an optional base string (e.g., SKU). */
export function generateBarcode(base?: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  if (base && /^[A-Z0-9-]{2,}$/.test(base.toUpperCase())) {
    return `${base.toUpperCase()}-${rand}`;
  }
  return `SLB${ts}${rand}`;
}

/** Generate a SKU suitable for apparel (Category prefix + size + sequence). */
export function generateSku(prefix: string, seq: number): string {
  return `${prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4)}-${String(seq).padStart(4, "0")}`;
}

/** Sanitise a string so it can be encoded in Code128 safely. */
export function sanitiseCode128(value: string): string {
  // Code128 supports full ASCII (0-127); strip anything outside that
  return value.replace(/[^\x00-\x7F]/g, "").trim().toUpperCase();
}

/* ─────────────── Label HTML builder (deprecated - see module docs) ─────────────── */

import type { Symbology } from "./labels/types";

export interface LabelData {
  barcode: string;
  format: Symbology;
  title: string;
  sku?: string;
  price?: string;
  /** Pre-rendered SVG string from the label engine */
  svgString?: string;
  /** Pre-rendered QR data URL (legacy path - QR now renders as SVG like everything else) */
  qrDataUrl?: string;
}

/** @deprecated Use buildTemplateLabelHtml (lib/labels/print.ts) once available - this predates real mm-grid positioning. */
export function buildLabelHtml(data: LabelData, size: LabelSize): string {
  const w = `${size.widthMM}mm`;
  const h = `${size.heightMM}mm`;
  const isQr = data.format === "QR";
  const barcodeContent = isQr && data.qrDataUrl
    ? `<img src="${data.qrDataUrl}" style="width:${size.heightMM - 4}mm;height:${size.heightMM - 4}mm;display:block;margin:auto;" />`
    : data.svgString
    ? `<div style="text-align:center;">${data.svgString}</div>`
    : `<p style="font-size:9px;text-align:center;word-break:break-all;">${data.barcode}</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: ${w} ${h}; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: ${w}; height: ${h}; font-family: Arial, sans-serif; overflow: hidden; padding: 1.5mm; }
.title { font-size: ${size.widthMM > 60 ? "8" : "6"}px; font-weight: 700; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 1mm; }
.sku   { font-size: 6px; text-align: center; color: #555; margin-top: 0.5mm; }
.price { font-size: ${size.widthMM > 60 ? "8" : "7"}px; font-weight: 700; text-align: center; }
svg    { max-width: 100%; height: auto; }
</style></head><body>
<p class="title">${data.title}</p>
${barcodeContent}
${data.sku ? `<p class="sku">${data.sku}</p>` : ""}
${data.price ? `<p class="price">${data.price}</p>` : ""}
</body></html>`;
}

/** @deprecated Use buildTemplateSheetHtml (lib/labels/print.ts) once available - this is flex-wrap, not a real Avery grid. */
export function buildSheetHtml(labels: LabelData[], size: LabelSize): string {
  const cells = labels
    .map((d) => {
      const isQr = d.format === "QR";
      const content = isQr && d.qrDataUrl
        ? `<img src="${d.qrDataUrl}" style="width:${Math.min(size.heightMM - 8, 30)}mm;height:${Math.min(size.heightMM - 8, 30)}mm;display:block;margin:0 auto;" />`
        : d.svgString
        ? d.svgString
        : `<p style="font-size:7px;word-break:break-all;text-align:center;">${d.barcode}</p>`;
      return `
        <div class="label">
          <p class="t">${d.title.slice(0, 28)}</p>
          ${content}
          ${d.sku ? `<p class="s">${d.sku}</p>` : ""}
          ${d.price ? `<p class="p">${d.price}</p>` : ""}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 5mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; }
.sheet { display: flex; flex-wrap: wrap; gap: 1mm; }
.label { width: ${size.widthMM}mm; height: ${size.heightMM}mm; border: 0.3mm dashed #ccc; padding: 1mm; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.t { font-size: ${size.widthMM > 60 ? "7" : "5.5"}px; font-weight: 700; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.s { font-size: 5.5px; color: #555; text-align: center; }
.p { font-size: ${size.widthMM > 60 ? "7.5" : "6"}px; font-weight: 700; text-align: center; }
svg { max-width: 100%; height: auto; }
</style></head><body><div class="sheet">${cells}</div></body></html>`;
}

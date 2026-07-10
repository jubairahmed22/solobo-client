/**
 * Barcode utilities - generation, validation, label sizing, SKU generation.
 * All browser-safe: no DOM access, no side effects.
 */

/* ─────────────── Formats ─────────────── */

export type BarcodeFormat = "CODE128" | "EAN13" | "UPCA" | "EAN8" | "CODE39" | "QR";

export interface FormatMeta {
  id: BarcodeFormat;
  label: string;
  description: string;
  maxChars: number;
  numeric: boolean;
}

export const BARCODE_FORMATS: FormatMeta[] = [
  {
    id: "CODE128",
    label: "Code 128",
    description: "Universal - letters, numbers, symbols. Best for internal SKUs.",
    maxChars: 80,
    numeric: false,
  },
  {
    id: "EAN13",
    label: "EAN-13",
    description: "Retail standard (13 digits). Requires GS1 prefix for global use.",
    maxChars: 13,
    numeric: true,
  },
  {
    id: "UPCA",
    label: "UPC-A",
    description: "North American retail standard (12 digits).",
    maxChars: 12,
    numeric: true,
  },
  {
    id: "EAN8",
    label: "EAN-8",
    description: "Compact retail (8 digits). For small packaging.",
    maxChars: 8,
    numeric: true,
  },
  {
    id: "CODE39",
    label: "Code 39",
    description: "Older industrial standard - uppercase letters and digits only.",
    maxChars: 43,
    numeric: false,
  },
  {
    id: "QR",
    label: "QR Code",
    description: "2D code - stores URLs, large text, or structured data.",
    maxChars: 4296,
    numeric: false,
  },
];

/* ─────────────── Label sizes ─────────────── */

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

/* ─────────────── Check digit helpers ─────────────── */

function gs1CheckDigit(digits: string): number {
  const d = digits.replace(/\D/g, "").slice(0, -1);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    sum += parseInt(d.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const expected = gs1CheckDigit(code);
  return parseInt(code.charAt(12)) === expected;
}

export function isValidUPCA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  return isValidEAN13("0" + code);
}

export function isValidEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const sum = d.slice(0, 7).reduce((a, v, i) => a + v * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === (d[7] ?? 0);
}

/* ─────────────── Auto-detect format ─────────────── */

export function detectFormat(value: string): BarcodeFormat {
  if (!value) return "CODE128";
  if (/^\d{13}$/.test(value) && isValidEAN13(value)) return "EAN13";
  if (/^\d{12}$/.test(value) && isValidUPCA(value)) return "UPCA";
  if (/^\d{8}$/.test(value) && isValidEAN8(value)) return "EAN8";
  return "CODE128";
}

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

/* ─────────────── Print helpers ─────────────── */

/**
 * Open a print dialog for a pre-built HTML string, using a hidden iframe so
 * the main page layout is not disturbed.
 */
export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;width:0;height:0;border:0;left:-9999px;top:-9999px;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  // Small delay so images/SVGs can render before printing
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 400);
}

/* ─────────────── Label HTML builder ─────────────── */

export interface LabelData {
  barcode: string;
  format: BarcodeFormat;
  title: string;
  sku?: string;
  price?: string;
  /** Pre-rendered SVG string from JsBarcode */
  svgString?: string;
  /** Pre-rendered QR data URL */
  qrDataUrl?: string;
}

/** Build a full @page print document for a single label. */
export function buildLabelHtml(data: LabelData, size: LabelSize): string {
  const w = `${size.widthMM}mm`;
  const h = `${size.heightMM}mm`;
  const isQr = data.format === "QR";
  const barcodeContent = isQr
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

/** Build a sheet of labels (for Avery-style full-page printing). */
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

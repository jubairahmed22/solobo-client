import type { LabelTemplate } from "../types";

/**
 * Retail Price Tag - 2" x 1.25". Large enough to host a GS1-compliant
 * EAN-13/UPC-A at the spec-minimum 80% magnification (29.83 x 20.74mm) with
 * room left for title + price. A field's `w`/`h` is the box the renderer
 * center-fits the barcode's true rendered size into (see print.ts) - it is
 * NOT a size the barcode gets stretched/distorted to match.
 */
export const RETAIL_PRICE_TAG_2X125: LabelTemplate = {
  id: "retail-price-tag-2x1.25",
  name: 'Retail Price Tag (2" × 1.25")',
  category: "retail",
  size: { widthMM: 50.8, heightMM: 31.75 },
  dualSided: false,
  bleedMM: 0,
  defaultSymbology: "EAN13",
  minDpi: 300,
  fields: [
    { id: "title", kind: "text", source: "title", x: 2, y: 1, w: 46.8, h: 5, fontSizePt: 7, bold: true, align: "center", maxLines: 1 },
    { id: "barcode", kind: "symbology", x: 2, y: 6.5, w: 46.8, h: 22, renderOptions: { magnificationPct: 80 } },
    { id: "price", kind: "text", source: "price", x: 2, y: 27, w: 46.8, h: 4.5, fontSizePt: 10, bold: true, align: "center" },
  ],
};

/**
 * Retail Price Tag - 1.5" x 1". Too small to fit a GS1-minimum-magnification
 * EAN-13 (which needs ~21mm of height alone) alongside a title and price, so
 * this compact variant defaults to Code128 - no magnification floor, sized
 * to the label rather than to a retail-scanning spec. The product's own
 * packaging carries the compliant EAN-13/UPC-A; this tag is for shelf/staff
 * lookup, matching common practice on tags this size.
 */
export const RETAIL_PRICE_TAG_1_5X1: LabelTemplate = {
  id: "retail-price-tag-1.5x1",
  name: 'Retail Price Tag (1.5" × 1")',
  category: "retail",
  size: { widthMM: 38.1, heightMM: 25.4 },
  dualSided: false,
  bleedMM: 0,
  defaultSymbology: "CODE128",
  minDpi: 300,
  fields: [
    { id: "title", kind: "text", source: "title", x: 1.5, y: 1, w: 35.1, h: 4.5, fontSizePt: 6, bold: true, align: "center", maxLines: 1 },
    { id: "barcode", kind: "symbology", x: 1.5, y: 6, w: 35.1, h: 13, renderOptions: { heightMM: 10 } },
    { id: "price", kind: "text", source: "price", x: 1.5, y: 20, w: 35.1, h: 4.5, fontSizePt: 9, bold: true, align: "center" },
  ],
};

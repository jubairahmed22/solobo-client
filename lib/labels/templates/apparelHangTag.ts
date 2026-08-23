import type { LabelTemplate } from "../types";

/**
 * Apparel Hang Tag - 2" x 3.5", dual-sided. Front carries branding + price;
 * back carries the scannable code plus the variant (size/color) text sourced
 * from the product's `variants[].options` map.
 */
export const APPAREL_HANG_TAG_2X35: LabelTemplate = {
  id: "apparel-hang-tag-2x3.5",
  name: 'Apparel Hang Tag (2" × 3.5")',
  category: "apparel",
  size: { widthMM: 50.8, heightMM: 88.9 },
  dualSided: true,
  bleedMM: 3.175, // 0.125" - sheet-fed hang tag stock is commonly die-cut after printing
  defaultSymbology: "QR",
  minDpi: 300,
  fields: [
    // Front - brand header + price.
    { id: "title", kind: "text", source: "title", side: "front", x: 4, y: 10, w: 42.8, h: 20, fontSizePt: 12, bold: true, align: "center", maxLines: 2 },
    { id: "price", kind: "text", source: "price", side: "front", x: 4, y: 60, w: 42.8, h: 8, fontSizePt: 14, bold: true, align: "center" },
    // Back - barcode/QR + variant (size/color) text + SKU.
    { id: "barcode", kind: "symbology", side: "back", x: 10.4, y: 10, w: 30, h: 30, renderOptions: { heightMM: 30 } },
    { id: "variant", kind: "text", source: "custom", side: "back", x: 4, y: 44, w: 42.8, h: 6, fontSizePt: 9, align: "center" },
    { id: "sku", kind: "text", source: "sku", side: "back", x: 4, y: 52, w: 42.8, h: 5, fontSizePt: 7, align: "center" },
  ],
};

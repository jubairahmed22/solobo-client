import type { LabelTemplate } from "../types";

/**
 * Master Carton ITF-14 Label. The barcode field's `includeText` (default
 * true) already prints the human-readable GTIN under the bars via bwip-js,
 * so there's no separate duplicate text field for it - only genuinely
 * distinct information (case SKU, carton contents/box count) gets its own
 * field.
 */
export const MASTER_CARTON_ITF14_4X6: LabelTemplate = {
  id: "master-carton-itf14-4x6",
  name: "Master Carton ITF-14 Label (4x6)",
  category: "carton",
  size: { widthMM: 101.6, heightMM: 152.4 },
  dualSided: false,
  bleedMM: 0,
  defaultSymbology: "ITF14",
  minDpi: 300,
  fields: [
    { id: "caseSku", kind: "text", source: "sku", x: 6, y: 6, w: 89.6, h: 8, fontSizePt: 12, bold: true, align: "center" },
    { id: "barcode", kind: "symbology", x: 6, y: 20, w: 89.6, h: 55, symbology: "ITF14", renderOptions: { heightMM: 45, bearerBar: true } },
    { id: "contents", kind: "text", source: "custom", x: 6, y: 80, w: 89.6, h: 20, fontSizePt: 10, align: "center", maxLines: 3 },
  ],
};

export const MASTER_CARTON_ITF14_4X3: LabelTemplate = {
  id: "master-carton-itf14-4x3",
  name: "Master Carton ITF-14 Label (4x3)",
  category: "carton",
  size: { widthMM: 101.6, heightMM: 76.2 },
  dualSided: false,
  bleedMM: 0,
  defaultSymbology: "ITF14",
  minDpi: 300,
  fields: [
    { id: "caseSku", kind: "text", source: "sku", x: 6, y: 4, w: 89.6, h: 7, fontSizePt: 10, bold: true, align: "center" },
    { id: "barcode", kind: "symbology", x: 6, y: 13, w: 89.6, h: 38, symbology: "ITF14", renderOptions: { heightMM: 30, bearerBar: true } },
    { id: "contents", kind: "text", source: "custom", x: 6, y: 54, w: 89.6, h: 18, fontSizePt: 8, align: "center", maxLines: 3 },
  ],
};

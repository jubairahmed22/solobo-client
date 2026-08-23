import type { LabelTemplate } from "../types";

/**
 * Warehouse Shelf Bin Label - 3" x 1". High-contrast Code128 location
 * barcode: pure black-on-white (no color options), large minimum text size
 * for readability from a few feet away on a shelf/rack.
 */
export const WAREHOUSE_BIN_3X1: LabelTemplate = {
  id: "warehouse-bin-3x1",
  name: "Warehouse Shelf Bin Label",
  category: "warehouse",
  size: { widthMM: 76.2, heightMM: 25.4 },
  dualSided: false,
  bleedMM: 0,
  defaultSymbology: "CODE128",
  minDpi: 300,
  fields: [
    {
      id: "barcode",
      kind: "symbology",
      x: 4,
      y: 2,
      w: 68.2,
      h: 15,
      symbology: "CODE128",
      renderOptions: { heightMM: 13, backgroundColor: "#FFFFFF", barColor: "#000000" },
    },
    { id: "binName", kind: "text", source: "title", x: 4, y: 18, w: 68.2, h: 6, fontSizePt: 10, bold: true, align: "center", maxLines: 1 },
  ],
};

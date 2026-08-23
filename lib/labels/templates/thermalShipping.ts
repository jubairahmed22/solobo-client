import type { LabelTemplate } from "../types";

/**
 * 4x6 Thermal Shipping Label. Edge-to-edge on thermal roll stock (no bleed -
 * die-cutting doesn't apply to a continuous roll). Ship-to block, a large
 * Code128 tracking-number barcode, order number, and a small QR for
 * carrier/tracking-URL convenience.
 */
export const THERMAL_SHIPPING_4X6: LabelTemplate = {
  id: "thermal-shipping-4x6",
  name: "4x6 Thermal Shipping Label",
  category: "shipping",
  size: { widthMM: 101.6, heightMM: 152.4 },
  dualSided: false,
  bleedMM: 0,
  defaultSymbology: "CODE128",
  minDpi: 300,
  fields: [
    { id: "shipTo", kind: "text", source: "custom", x: 6, y: 6, w: 89.6, h: 40, fontSizePt: 11, align: "left", maxLines: 6 },
    { id: "orderNumber", kind: "text", source: "sku", x: 6, y: 50, w: 89.6, h: 6, fontSizePt: 9, align: "left" },
    { id: "tracking", kind: "symbology", x: 6, y: 60, w: 89.6, h: 30, symbology: "CODE128", renderOptions: { heightMM: 25 } },
    { id: "trackingNumber", kind: "text", source: "custom", x: 6, y: 92, w: 89.6, h: 6, fontSizePt: 10, align: "center" },
    { id: "qr", kind: "symbology", x: 75.6, y: 100, w: 20, h: 20, symbology: "QR" },
  ],
};

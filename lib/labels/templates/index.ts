import type { LabelTemplate } from "../types";
import { RETAIL_PRICE_TAG_2X125, RETAIL_PRICE_TAG_1_5X1 } from "./retailPriceTag";
import { APPAREL_HANG_TAG_2X35 } from "./apparelHangTag";
import { THERMAL_SHIPPING_4X6 } from "./thermalShipping";
import { MASTER_CARTON_ITF14_4X6, MASTER_CARTON_ITF14_4X3 } from "./masterCartonItf14";
import { WAREHOUSE_BIN_3X1 } from "./warehouseBin";

/**
 * The template registry - the only place a new template needs to be
 * registered. Every consumer (engine.ts, pdf.ts, print.ts, zpl.ts,
 * sheets.ts) is generic over `LabelTemplate.fields[]` and never references
 * a specific template by id, so adding a 6th template is exactly one new
 * file here plus one line below.
 */
export const TEMPLATES: LabelTemplate[] = [
  RETAIL_PRICE_TAG_2X125,
  RETAIL_PRICE_TAG_1_5X1,
  APPAREL_HANG_TAG_2X35,
  THERMAL_SHIPPING_4X6,
  MASTER_CARTON_ITF14_4X6,
  MASTER_CARTON_ITF14_4X3,
  WAREHOUSE_BIN_3X1,
];

export function getTemplate(id: string): LabelTemplate {
  const t = TEMPLATES.find((tpl) => tpl.id === id);
  if (!t) throw new Error(`Unknown label template: ${id}`);
  return t;
}

export {
  RETAIL_PRICE_TAG_2X125,
  RETAIL_PRICE_TAG_1_5X1,
  APPAREL_HANG_TAG_2X35,
  THERMAL_SHIPPING_4X6,
  MASTER_CARTON_ITF14_4X6,
  MASTER_CARTON_ITF14_4X3,
  WAREHOUSE_BIN_3X1,
};

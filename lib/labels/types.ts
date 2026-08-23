/**
 * Shared types for the label/barcode engine (lib/labels/*). One symbology
 * engine (engine.ts, bwip-js-backed), one template model, one sheet/grid
 * model - every export path (SVG/PNG/PDF/ZPL/print) is generic over these.
 */

export type Symbology =
  | "CODE128"
  | "EAN13"
  | "UPCA"
  | "EAN8"
  | "CODE39"
  | "ITF14"
  | "QR"
  | "DATAMATRIX";

/* ─────────────── Symbology rendering ─────────────── */

export interface RenderOptions {
  value: string;
  symbology: Symbology;
  /** 80-200. EAN13/UPCA/EAN8 only - scales the GS1 nominal 100% physical size. Default 100. */
  magnificationPct?: number;
  /** QR only. Default "M". */
  eclevel?: "L" | "M" | "Q" | "H";
  /** ITF-14 only. Toggles the bearer box border. Default true. */
  bearerBar?: boolean;
  /** Human-readable text under linear codes. Default true. */
  includeText?: boolean;
  /** Explicit symbol height override, mm. Ignored by 2D codes (QR/DataMatrix are square). */
  heightMM?: number;
  /** Explicit symbol width override, mm. Only meaningful for symbologies with no fixed nominal size (CODE128/CODE39/QR/DataMatrix). */
  widthMM?: number;
  backgroundColor?: string;
  barColor?: string;
}

export interface RenderResult {
  /** Vector source of truth - root <svg> has explicit width/height in mm. */
  svg: string;
  widthMM: number;
  heightMM: number;
}

/* ─────────────── Templates ─────────────── */

export interface PhysicalSize {
  widthMM: number;
  heightMM: number;
}

export interface LabelField {
  id: string;
  kind: "text" | "symbology";
  /** Text fields only - which piece of the LabelItem this field renders. "custom" reads LabelItem.custom[id]. */
  source?: "title" | "sku" | "price" | "custom";
  fontSizePt?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  maxLines?: number;
  /** Symbology fields only. */
  symbology?: Symbology;
  renderOptions?: Partial<Omit<RenderOptions, "value" | "symbology">>;
  /** Position/size in mm, relative to this side's origin (top-left). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Only meaningful when the owning template has dualSided: true. */
  side?: "front" | "back";
}

export interface LabelTemplate {
  id: string;
  name: string;
  category: "retail" | "apparel" | "shipping" | "carton" | "warehouse";
  size: PhysicalSize;
  dualSided: boolean;
  /** mm. 0 for thermal/die-cut stock, 3.175mm (0.125") default for sheet-fed templates. */
  bleedMM: number;
  fields: LabelField[];
  defaultSymbology: Symbology;
  minDpi: 300;
}

/* ─────────────── Batch items / sheets ─────────────── */

export interface LabelItem {
  /** Stable key for React lists / dedup - not printed. */
  key: string;
  value: string;
  title?: string;
  sku?: string;
  price?: string;
  custom?: Record<string, string>;
  symbology?: Symbology;
  templateId?: string;
}

export interface SheetLayout {
  id: string;
  name: string;
  pageSize: PhysicalSize;
  cell: PhysicalSize;
  columns: number;
  rows: number;
  marginTopMM: number;
  marginLeftMM: number;
  colGapMM: number;
  rowGapMM: number;
  cellsPerSheet: number;
}

export interface PaginatedCell {
  page: number;
  col: number;
  row: number;
  xMM: number;
  yMM: number;
  item: LabelItem;
}

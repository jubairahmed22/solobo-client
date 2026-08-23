import type { Symbology } from "./types";
import { validateForSymbology } from "./validation";

/**
 * Raw ZPL (Zebra Programming Language) generation for industrial thermal
 * printers. Pure text templating - ZPL printers rasterize barcodes
 * on-device from the ^B* commands below, so this module has no rendering
 * dependency on bwip-js/engine.ts at all. Commands reference the Zebra ZPL
 * II Programming Guide.
 *
 * EAN-8 has no standard dedicated ZPL barcode command on typical Zebra
 * firmware - `buildZplLabel` throws for that combination rather than
 * emitting something wrong; callers should disable ZPL export in the UI
 * when EAN-8 is selected.
 */

const mmToDots = (mm: number, dpi: number) => Math.round((mm * dpi) / 25.4);

export interface ZplLabelOptions {
  value: string;
  symbology: Symbology;
  /** Physical label size, mm - drives ^PW (print width) / ^LL (label length). */
  widthMM: number;
  heightMM: number;
  /** Target printer resolution. Zebra thermal printers commonly ship at 203, 300, or 600 dpi. Default 300. */
  dpi?: 203 | 300 | 600;
  /** EAN13/UPCA/EAN8 only - scales the barcode module width proportionally. */
  magnificationPct?: number;
  /** QR only. Default "M". */
  eclevel?: "L" | "M" | "Q" | "H";
  includeText?: boolean;
  /** Margin from the label edge to the barcode's top-left, mm. Default 2. */
  marginMM?: number;
}

/** The ^B* command + its parameter line for one symbology, given a target module width and bar height (dots). */
function symbologyCommand(
  symbology: Symbology,
  value: string,
  moduleWidthDots: number,
  heightDots: number,
  includeText: boolean,
  eclevel: "L" | "M" | "Q" | "H",
): string {
  const yn = (b: boolean) => (b ? "Y" : "N");
  switch (symbology) {
    case "CODE128":
      // ^BC: orientation, height, print interpretation line, line above, UCC check digit, mode
      return `^BY${moduleWidthDots}\n^BCN,${heightDots},${yn(includeText)},N,N\n^FD${value}^FS`;
    case "EAN13":
      // ^BE: orientation, height, print interpretation line, line above
      return `^BY${moduleWidthDots}\n^BEN,${heightDots},${yn(includeText)},N\n^FD${value}^FS`;
    case "UPCA":
      // ^BU: orientation, height, print interpretation line, line above, UPC check digit already included
      return `^BY${moduleWidthDots}\n^BUN,${heightDots},${yn(includeText)},N,N\n^FD${value}^FS`;
    case "CODE39":
      // ^B3: orientation, check digit, height, line, line above
      return `^BY${moduleWidthDots}\n^B3N,N,${heightDots},${yn(includeText)},N\n^FD${value}^FS`;
    case "ITF14":
      // ^B2: Interleaved 2-of-5 - orientation, height, line, line above, UCC check digit
      return `^BY${moduleWidthDots}\n^B2N,${heightDots},${yn(includeText)},N,N\n^FD${value}^FS`;
    case "QR":
      // ^BQ: model 2, magnification derived from moduleWidthDots. Field data is
      // prefixed "<eclevel>A," (A = automatic mask) per the ZPL II guide.
      return `^BQN,2,${Math.max(1, Math.round(moduleWidthDots / 3))}\n^FD${eclevel}A,${value}^FS`;
    case "DATAMATRIX":
      // ^BX: orientation, height(module multiplier), quality(ECC200=200), columns, rows
      return `^BXN,${Math.max(1, Math.round(moduleWidthDots / 3))},200\n^FD${value}^FS`;
    case "EAN8":
      throw new Error("EAN-8 has no standard ZPL barcode command on typical Zebra firmware - not supported for ZPL export.");
  }
}

/** Build one complete `^XA...^XZ` ZPL label. */
export function buildZplLabel(opts: ZplLabelOptions): string {
  const { valid, errors } = validateForSymbology(opts.value, opts.symbology);
  if (!valid) {
    throw new Error(`Cannot build ZPL for ${opts.symbology} "${opts.value}": ${errors.join("; ")}`);
  }

  const dpi = opts.dpi ?? 300;
  const marginMM = opts.marginMM ?? 2;
  const widthDots = mmToDots(opts.widthMM, dpi);
  const lengthDots = mmToDots(opts.heightMM, dpi);
  const marginDots = mmToDots(marginMM, dpi);

  // Bar height fills most of the label, leaving room for the margin and
  // (for linear codes) the human-readable text line ZPL prints below.
  const barcodeHeightDots = Math.max(1, lengthDots - marginDots * 2);

  // Module width: 1 dot at 100% magnification is too thin to scan reliably
  // at typical retail DPIs, so the baseline module is 2 dots, scaled by
  // magnificationPct (EAN13/UPCA/EAN8 only - see engine.ts for the same
  // magnification contract applied to SVG rendering).
  const mag = Math.min(200, Math.max(80, opts.magnificationPct ?? 100)) / 100;
  const moduleWidthDots = Math.max(1, Math.round(2 * mag));

  const body = symbologyCommand(
    opts.symbology,
    opts.value,
    moduleWidthDots,
    barcodeHeightDots,
    opts.includeText ?? true,
    opts.eclevel ?? "M",
  );

  return [
    "^XA",
    `^PW${widthDots}`,
    `^LL${lengthDots}`,
    `^FO${marginDots},${marginDots}`,
    body,
    "^XZ",
  ].join("\n");
}

/** Concatenate several labels into one ZPL batch - printers process consecutive ^XA...^XZ blocks as separate labels. */
export function buildZplBatch(labels: ZplLabelOptions[]): string {
  return labels.map(buildZplLabel).join("\n");
}

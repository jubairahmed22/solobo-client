import type { RenderOptions, RenderResult, Symbology } from "./types";
import { validateForSymbology } from "./validation";

/**
 * The single symbology rendering engine - wraps bwip-js (BWIPP), which
 * covers every symbology this system needs (Code128 with automatic A/B/C
 * subset switching, EAN-13/UPC-A/EAN-8 with GS1-conformant guard bars and
 * quiet zones, ITF-14 with its bearer box, QR with selectable error
 * correction, DataMatrix) through one consistent options shape, replacing
 * the old jsbarcode+qrcode combo (BarcodeTag.tsx/LabelSheet.tsx/
 * enrichLabels.ts previously had two structurally different render paths
 * for the same "render a code" concept).
 *
 * Physical sizing: bwip-js's internal SVG units are an implementation
 * detail we deliberately never depend on. For symbologies with a
 * GS1-published nominal 100%-magnification physical size (EAN-13/UPC-A/
 * EAN-8), we compute the target mm size ourselves from that published spec
 * and stamp it onto the output SVG's width/height attributes - bwip-js is
 * responsible only for correct bar-pattern geometry inside its own
 * viewBox, never for the physical scale. For everything else, physical
 * size follows the caller's requested height/width (falling back to a
 * sensible per-symbology default), scaled proportionally from the
 * rendered viewBox's own aspect ratio so bars are never stretched.
 */

const BCID: Record<Symbology, string> = {
  CODE128: "code128",
  EAN13: "ean13",
  UPCA: "upca",
  EAN8: "ean8",
  CODE39: "code39",
  ITF14: "itf14",
  QR: "qrcode",
  DATAMATRIX: "datamatrix",
};

/**
 * GS1-published nominal size AT 100% MAGNIFICATION, including standard
 * quiet zones - these are fixed industry constants, not measured from
 * bwip-js output. Magnification (80-200%) scales both dimensions linearly.
 */
const NOMINAL_100PCT_MM: Partial<Record<Symbology, { widthMM: number; heightMM: number }>> = {
  EAN13: { widthMM: 37.29, heightMM: 25.93 },
  UPCA: { widthMM: 36.3, heightMM: 25.9 },
  EAN8: { widthMM: 26.73, heightMM: 21.3 },
};

/** Default physical size for symbologies with no fixed nominal (height for linear codes, side length for 2D). */
const DEFAULT_SIZE_MM: Record<Symbology, number> = {
  CODE128: 15,
  CODE39: 15,
  ITF14: 32,
  QR: 25,
  DATAMATRIX: 15,
  EAN13: 25.93,
  UPCA: 25.9,
  EAN8: 21.3,
};

const ITF14_BEARER_MM = 4.8;
const ITF14_BEARER_TOLERANCE_MM = 0.1;

function isLinear(symbology: Symbology): boolean {
  return symbology !== "QR" && symbology !== "DATAMATRIX";
}

/** Insert (or replace) width/height="…mm" attributes on the root <svg> tag, leaving viewBox untouched. */
function stampPhysicalSize(svg: string, widthMM: number, heightMM: number): string {
  const w = widthMM.toFixed(2);
  const h = heightMM.toFixed(2);
  let out = svg.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "");
  out = out.replace(/^<svg\b/, `<svg width="${w}mm" height="${h}mm"`);
  return out;
}

function parseViewBox(svg: string): { w: number; h: number } {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!m) return { w: 1, h: 1 };
  return { w: parseFloat(m[1]!), h: parseFloat(m[2]!) };
}

/**
 * Render one symbology to an SVG string with an explicit physical (mm)
 * size. Validates the value first - never renders something that fails its
 * symbology's check digit/length/charset rules (requirement: robust
 * parameter validation before generation).
 */
export async function renderSymbology(opts: RenderOptions): Promise<RenderResult> {
  const { valid, errors } = validateForSymbology(opts.value, opts.symbology);
  if (!valid) {
    throw new Error(`Cannot render ${opts.symbology} "${opts.value}": ${errors.join("; ")}`);
  }

  if (opts.symbology === "ITF14") {
    const bearerWidth = opts.bearerBar === false ? undefined : ITF14_BEARER_MM;
    if (
      opts.bearerBar !== false &&
      opts.bearerBar !== undefined &&
      Math.abs(bearerWidth! - ITF14_BEARER_MM) > ITF14_BEARER_TOLERANCE_MM
    ) {
      // Unreachable today (bearerBar is boolean-only) - guards against a
      // future numeric bearer-width option being added without updating
      // this check, since GS1's 4.8mm bearer thickness is not independently
      // configurable through the underlying encoder.
      throw new Error("ITF-14 bearer box thickness is fixed at 4.8mm by the GS1 spec and is not adjustable.");
    }
  }

  // Explicit "/browser" subpath rather than the bare "bwip-js" specifier -
  // this module only ever runs client-side, and the package's top-level "."
  // export nests its types under platform-specific conditions (browser/node/
  // electron/react-native) that plain `moduleResolution: "bundler"` doesn't
  // resolve without extra tsconfig config. The "/browser" subpath is an
  // unconditional export pointing at the same build, so it resolves cleanly
  // with zero project-wide config changes.
  const bwipjs = (await import("bwip-js/browser")).default;

  const bcid = BCID[opts.symbology];
  const renderOpts: Record<string, unknown> = {
    bcid,
    text: opts.value,
    backgroundcolor: (opts.backgroundColor ?? "#FFFFFF").replace("#", ""),
    barcolor: (opts.barColor ?? "#000000").replace("#", ""),
  };

  if (isLinear(opts.symbology)) {
    renderOpts.includetext = opts.includeText ?? true;
  }

  if (opts.symbology === "EAN13" || opts.symbology === "UPCA" || opts.symbology === "EAN8") {
    renderOpts.guardwhitespace = true; // GS1 extended quiet zone under the guard bars - never disabled
  }

  if (opts.symbology === "ITF14") {
    renderOpts.showborder = opts.bearerBar ?? true; // default GS1-conformant bearer box
  }

  if (opts.symbology === "QR") {
    // `eclevel` is a real, documented BWIPP option (confirmed against
    // barcode.ps's qrcode encoder) that the community .d.ts doesn't model -
    // hence the cast below rather than a missing-property error.
    renderOpts.eclevel = opts.eclevel ?? "M";
  }

  // eclevel above is the only option bwip-js's .d.ts doesn't type; everything
  // else (bcid/text/includetext/guardwhitespace/showborder/backgroundcolor/
  // barcolor) is in its official RenderOptions/BwippOptions types.
  const rawSvg = bwipjs.toSVG(renderOpts as unknown as Parameters<typeof bwipjs.toSVG>[0]);

  const vb = parseViewBox(rawSvg);
  const aspect = vb.w / vb.h;

  let widthMM: number;
  let heightMM: number;

  const nominal = NOMINAL_100PCT_MM[opts.symbology];
  if (nominal) {
    const mag = Math.min(200, Math.max(80, opts.magnificationPct ?? 100)) / 100;
    widthMM = nominal.widthMM * mag;
    heightMM = nominal.heightMM * mag;
  } else if (opts.widthMM && opts.heightMM) {
    widthMM = opts.widthMM;
    heightMM = opts.heightMM;
  } else if (opts.heightMM) {
    heightMM = opts.heightMM;
    widthMM = heightMM * aspect;
  } else if (opts.widthMM) {
    widthMM = opts.widthMM;
    heightMM = widthMM / aspect;
  } else {
    const d = DEFAULT_SIZE_MM[opts.symbology];
    if (isLinear(opts.symbology)) {
      heightMM = d;
      widthMM = heightMM * aspect;
    } else {
      widthMM = d;
      heightMM = d; // 2D codes are square
    }
  }

  return { svg: stampPhysicalSize(rawSvg, widthMM, heightMM), widthMM, heightMM };
}

export async function renderSvgString(opts: RenderOptions): Promise<string> {
  return (await renderSymbology(opts)).svg;
}

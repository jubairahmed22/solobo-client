import type { LabelData, LabelSize } from "@/lib/barcode";
import { renderSymbology } from "@/lib/labels/engine";

/**
 * Enriches label data with rendered SVG strings from the unified label
 * engine (lib/labels/engine.ts) - required before passing to the print
 * HTML builder. Runs client-side only (bwip-js is dynamically imported).
 */
export async function enrichLabels(labels: LabelData[], size: LabelSize): Promise<LabelData[]> {
  return Promise.all(
    labels.map(async (label): Promise<LabelData> => {
      try {
        const { svg } = await renderSymbology({
          value: label.barcode,
          symbology: label.format,
          heightMM: Math.max(size.heightMM * 0.5, 10),
        });
        return { ...label, svgString: svg };
      } catch {
        // invalid value/format combo - leave svgString empty, buildSheetHtml
        // falls back to a plain-text rendering of the raw value.
        return label;
      }
    }),
  );
}

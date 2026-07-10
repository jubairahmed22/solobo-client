import type { LabelData, LabelSize } from "@/lib/barcode";

/**
 * Enriches label data with rendered SVG strings (for linear barcodes) or
 * QR data URLs - required before passing to the print HTML builder.
 * Runs client-side only (requires DOM + canvas).
 */
export async function enrichLabels(labels: LabelData[], size: LabelSize): Promise<LabelData[]> {
  return Promise.all(
    labels.map(async (label): Promise<LabelData> => {
      if (label.format === "QR") {
        const QRCode = await import("qrcode");
        const qrDataUrl = await QRCode.toDataURL(label.barcode, {
          width: size.widthMM * 3.78,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        return { ...label, qrDataUrl };
      }

      const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const { default: JsBarcode } = await import("jsbarcode");
      try {
        JsBarcode(svgEl, label.barcode, {
          format: label.format === "UPCA" ? "UPC" : label.format,
          width: 1.5,
          height: Math.max(size.heightMM * 2.2, 30),
          displayValue: true,
          fontSize: Math.max(size.widthMM / 8, 8),
          margin: 4,
          background: "#ffffff",
          lineColor: "#0A0A0A",
          textMargin: 2,
        });
      } catch {
        /* invalid value/format combo - leave svgString empty */
      }

      return { ...label, svgString: svgEl.outerHTML };
    }),
  );
}

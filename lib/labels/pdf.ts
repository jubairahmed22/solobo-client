import type { LabelItem, LabelTemplate, SheetLayout } from "./types";
import { renderPng } from "./raster";
import { renderSymbology } from "./engine";
import { paginate } from "./sheets";
import type BlobStreamCtor from "blob-stream";

/**
 * Vector multi-page PDF export via pdfkit's browser-standalone build +
 * blob-stream, both dynamically imported client-side (same pattern as
 * bwip-js). Text and page layout are true vector; each symbology field is
 * embedded as a high-DPI (300/600) raster PNG produced by raster.ts's
 * `renderPng` - see the module docs in raster.ts and pdf.ts's own note on
 * `colorMode` below for why a fully-vector bar path isn't used.
 */

const MM_TO_PT = 2.8346;
const mmToPt = (mm: number) => mm * MM_TO_PT;

export interface PdfExportOptions {
  /**
   * "grayscale-k" (default) fills text as pure K (CMYK [0,0,0,100]) - the
   * thermal/monochrome-safe choice, since it never lets a CMYK-separated
   * print job put ink on the C/M/Y plates for what should be pure black.
   * "cmyk" is accepted for future colored template content, but every
   * current template's fields are monochrome black text + black-on-white
   * barcodes, so the two modes render identically today - documented, not
   * a bug. Either way, embedded barcode PNGs remain RGB raster images (see
   * raster.ts) - colorMode only affects vector-drawn text.
   */
  colorMode?: "cmyk" | "grayscale-k";
  dpi?: 300 | 600;
}

const PURE_K_BLACK: [number, number, number, number] = [0, 0, 0, 100];

async function loadPdfKit() {
  const mod = (await import(
    /* webpackIgnore: false */ "pdfkit/js/pdfkit.standalone.js"
  )) as unknown as { default: typeof import("pdfkit") };
  return mod.default ?? (mod as unknown as typeof import("pdfkit"));
}

async function loadBlobStream() {
  const mod = (await import("blob-stream")) as unknown as { default: () => BlobStreamCtor.IBlobStream };
  return mod.default;
}

function resolveText(item: LabelItem, source: string | undefined, fieldId: string): string {
  switch (source) {
    case "title":
      return item.title ?? "";
    case "sku":
      return item.sku ?? "";
    case "price":
      return item.price ?? "";
    case "custom":
      return item.custom?.[fieldId] ?? "";
    default:
      return "";
  }
}

/** Draw one template instance (all its fields) at page-relative origin (originXMM, originYMM). */
async function drawTemplateInstance(
  doc: PDFKit.PDFDocument,
  item: LabelItem,
  template: LabelTemplate,
  side: "front" | "back" | undefined,
  originXMM: number,
  originYMM: number,
  dpi: 300 | 600,
): Promise<void> {
  const fields = template.fields.filter((f) => (template.dualSided ? f.side === side : true));
  for (const field of fields) {
    const xPt = mmToPt(originXMM + field.x);
    const yPt = mmToPt(originYMM + field.y);
    const wPt = mmToPt(field.w);
    const hPt = mmToPt(field.h);

    if (field.kind === "symbology") {
      const symbology = field.symbology ?? item.symbology ?? template.defaultSymbology;
      const { widthMM, heightMM } = await renderSymbology({ value: item.value, symbology, ...field.renderOptions });
      const png = await renderPng({ value: item.value, symbology, ...field.renderOptions }, dpi);
      const pngBuffer = Buffer.from(await png.arrayBuffer());
      // Center the true-rendered-size barcode within its allocated field box.
      const bw = mmToPt(widthMM);
      const bh = mmToPt(heightMM);
      doc.image(pngBuffer, xPt + (wPt - bw) / 2, yPt + (hPt - bh) / 2, { width: bw, height: bh });
    } else {
      const text = resolveText(item, field.source, field.id);
      doc
        .fillColor(PURE_K_BLACK)
        .font(field.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(field.fontSizePt ?? 8)
        .text(text, xPt, yPt, {
          width: wPt,
          height: hPt,
          align: field.align ?? "left",
          lineBreak: true,
        });
    }
  }
}

/**
 * Build a PDF for a batch of items against one template - either one page
 * (or two, front/back, for dual-sided templates) per item when `sheet` is
 * null, or a paginated Avery-style grid sheet when `sheet` is given.
 */
export async function buildLabelsPdf(
  items: LabelItem[],
  template: LabelTemplate,
  sheet: SheetLayout | null,
  opts: PdfExportOptions = {},
): Promise<Blob> {
  const dpi = opts.dpi ?? 300;
  const PDFDocument = await loadPdfKit();
  const blobStream = await loadBlobStream();

  const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
  const stream = doc.pipe(blobStream());

  if (sheet) {
    const pages = paginate(items, sheet, template);
    for (const cells of pages) {
      doc.addPage({ size: [mmToPt(sheet.pageSize.widthMM), mmToPt(sheet.pageSize.heightMM)], margin: 0 });
      for (const cell of cells) {
        await drawTemplateInstance(doc, cell.item, template, undefined, cell.xMM, cell.yMM, dpi);
      }
    }
  } else {
    const w = mmToPt(template.size.widthMM + template.bleedMM * 2);
    const h = mmToPt(template.size.heightMM + template.bleedMM * 2);
    for (const item of items) {
      if (template.dualSided) {
        doc.addPage({ size: [w, h], margin: 0 });
        await drawTemplateInstance(doc, item, template, "front", template.bleedMM, template.bleedMM, dpi);
        doc.addPage({ size: [w, h], margin: 0 });
        await drawTemplateInstance(doc, item, template, "back", template.bleedMM, template.bleedMM, dpi);
      } else {
        doc.addPage({ size: [w, h], margin: 0 });
        await drawTemplateInstance(doc, item, template, undefined, template.bleedMM, template.bleedMM, dpi);
      }
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(stream.toBlob("application/pdf")));
    stream.on("error", reject);
  });
}

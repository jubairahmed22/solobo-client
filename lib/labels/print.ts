import type { LabelItem, LabelTemplate, PaginatedCell, SheetLayout } from "./types";
import { renderSymbology } from "./engine";

/**
 * Open a print dialog for a pre-built HTML string, using a hidden iframe so
 * the main page layout is not disturbed. Format-agnostic - just takes an
 * HTML string, reused unchanged by every export path (single label, sheet,
 * template-driven builders below).
 */
export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;width:0;height:0;border:0;left:-9999px;top:-9999px;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  // Small delay so images/SVGs can render before printing
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 400);
}

/** fieldId -> rendered SVG string, for every symbology field in a template. */
export type RenderedFields = Record<string, string>;

/** Pre-render every symbology field for one item - required before either HTML builder below, since rendering is async and HTML building is not. */
export async function renderItemFields(item: LabelItem, template: LabelTemplate): Promise<RenderedFields> {
  const out: RenderedFields = {};
  for (const field of template.fields) {
    if (field.kind !== "symbology") continue;
    const { svg } = await renderSymbology({
      value: item.value,
      symbology: field.symbology ?? item.symbology ?? template.defaultSymbology,
      ...field.renderOptions,
    });
    out[field.id] = svg;
  }
  return out;
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

function fieldStyle(x: number, y: number, w: number, h: number): string {
  return `position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;`;
}

/** One template's fields, for a given side, as absolutely-positioned HTML - shared by the single-label and sheet-cell builders. */
function fieldsHtml(item: LabelItem, template: LabelTemplate, rendered: RenderedFields, side: "front" | "back" | undefined): string {
  return template.fields
    .filter((f) => (template.dualSided ? f.side === side : true))
    .map((f) => {
      if (f.kind === "symbology") {
        const svg = rendered[f.id] ?? "";
        return `<div style="${fieldStyle(f.x, f.y, f.w, f.h)}display:flex;align-items:center;justify-content:center;overflow:visible;">${svg}</div>`;
      }
      const text = resolveText(item, f.source, f.id);
      const lineClampCss = f.maxLines
        ? `display:-webkit-box;-webkit-line-clamp:${f.maxLines};-webkit-box-orient:vertical;overflow:hidden;`
        : "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      return `<div style="${fieldStyle(f.x, f.y, f.w, f.h)}font-family:Arial,sans-serif;font-size:${f.fontSizePt ?? 8}pt;font-weight:${f.bold ? 700 : 400};text-align:${f.align ?? "left"};${lineClampCss}">${text}</div>`;
    })
    .join("");
}

/** Build a full `@page` print document for one label at its true physical size (+ bleed). Dual-sided templates render front then back as two `@page` sections. */
export function buildTemplateLabelHtml(item: LabelItem, template: LabelTemplate, rendered: RenderedFields): string {
  const w = template.size.widthMM + template.bleedMM * 2;
  const h = template.size.heightMM + template.bleedMM * 2;

  const sideHtml = (side: "front" | "back" | undefined) => `
    <div class="side" style="position:relative;width:${template.size.widthMM}mm;height:${template.size.heightMM}mm;margin:${template.bleedMM}mm;">
      ${fieldsHtml(item, template, rendered, side)}
    </div>`;

  const sides = template.dualSided ? `${sideHtml("front")}${sideHtml("back")}` : sideHtml(undefined);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: ${w}mm ${h}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; }
.side { page-break-after: always; }
.side:last-child { page-break-after: auto; }
svg { display: block; }
</style></head><body>${sides}</body></html>`;
}

/** Build a multi-page Avery-grid (or unpaginated single-label) print document from `paginate()`'s output. */
export function buildTemplateSheetHtml(
  pages: PaginatedCell[][],
  template: LabelTemplate,
  sheet: SheetLayout,
  renderedByItemKey: Record<string, RenderedFields>,
): string {
  const pagesHtml = pages
    .map(
      (cells) => `
    <div class="page" style="position:relative;width:${sheet.pageSize.widthMM}mm;height:${sheet.pageSize.heightMM}mm;">
      ${cells
        .map((cell) => {
          const rendered = renderedByItemKey[cell.item.key] ?? {};
          return `<div style="position:absolute;left:${cell.xMM}mm;top:${cell.yMM}mm;width:${template.size.widthMM}mm;height:${template.size.heightMM}mm;">
            ${fieldsHtml(cell.item, template, rendered, undefined)}
          </div>`;
        })
        .join("")}
    </div>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: ${sheet.pageSize.widthMM}mm ${sheet.pageSize.heightMM}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
svg { display: block; }
</style></head><body>${pagesHtml}</body></html>`;
}

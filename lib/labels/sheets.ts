import type { LabelItem, LabelTemplate, PaginatedCell, SheetLayout } from "./types";

const IN_TO_MM = 25.4;
const inches = (n: number) => n * IN_TO_MM;

const US_LETTER = { widthMM: inches(8.5), heightMM: inches(11) };

/**
 * Avery 5160 - 1" x 2.625" address labels, 3 cols x 10 rows, 30/sheet.
 * Margins/gap verified against multiple independent sources and
 * self-consistency-checked against the page size: 0.1875 + 3×2.625 + 2×0.125
 * + 0.1875 = 8.5" across; 0.5 + 10×1.0 + 0.5 = 11.0" down. Both exact.
 */
export const AVERY_5160: SheetLayout = {
  id: "avery-5160",
  name: "Avery 5160 (1\" × 2.625\", 30/sheet)",
  pageSize: US_LETTER,
  cell: { widthMM: inches(2.625), heightMM: inches(1) },
  columns: 3,
  rows: 10,
  marginTopMM: inches(0.5),
  marginLeftMM: inches(0.1875),
  colGapMM: inches(0.125),
  rowGapMM: 0,
  cellsPerSheet: 30,
};

/**
 * Avery 5163 - 2" x 4" shipping labels, 2 cols x 5 rows, 10/sheet.
 * UNVERIFIED against an authoritative Avery source - Avery's own template
 * page doesn't publish raw margin numbers, and independent sources disagree
 * (side margin cited anywhere from 0.15" to 0.18", gap 0.18"-0.2"). The
 * values below (0.25" side margin, 0 gap) are the simplest option that sums
 * exactly to the 8.5" page width and match a commonly-cited convention, but
 * this needs a physical test print against real 5163 stock before
 * high-volume use - a small column/row drift here would misprint an entire
 * batch. See the Phase 2 verification note in the project plan.
 */
export const AVERY_5163: SheetLayout = {
  id: "avery-5163",
  name: 'Avery 5163 (2" × 4", 10/sheet) - unverified margins, test print before production use',
  pageSize: US_LETTER,
  cell: { widthMM: inches(4), heightMM: inches(2) },
  columns: 2,
  rows: 5,
  marginTopMM: inches(0.5),
  marginLeftMM: inches(0.25),
  colGapMM: 0,
  rowGapMM: 0,
  cellsPerSheet: 10,
};

export const SHEET_LAYOUTS: SheetLayout[] = [AVERY_5160, AVERY_5163];

export function getSheetLayout(id: string): SheetLayout {
  const s = SHEET_LAYOUTS.find((sh) => sh.id === id);
  if (!s) throw new Error(`Unknown sheet layout: ${id}`);
  return s;
}

const SIZE_TOLERANCE_MM = 0.5;

/**
 * Chunk `items` into sheet.cellsPerSheet-sized pages, computing each cell's
 * absolute (xMM, yMM) position from the sheet's margins/gaps. Rejects a
 * template whose physical size doesn't match the sheet's cell size - a
 * mismatch here would silently misprint every label on the sheet.
 */
export function paginate(items: LabelItem[], sheet: SheetLayout, template: LabelTemplate): PaginatedCell[][] {
  const widthOk = Math.abs(template.size.widthMM - sheet.cell.widthMM) <= SIZE_TOLERANCE_MM;
  const heightOk = Math.abs(template.size.heightMM - sheet.cell.heightMM) <= SIZE_TOLERANCE_MM;
  if (!widthOk || !heightOk) {
    throw new Error(
      `Template "${template.id}" (${template.size.widthMM}×${template.size.heightMM}mm) does not match ` +
        `sheet "${sheet.id}"'s cell size (${sheet.cell.widthMM}×${sheet.cell.heightMM}mm).`,
    );
  }

  const pages: PaginatedCell[][] = [];
  for (let i = 0; i < items.length; i += sheet.cellsPerSheet) {
    const pageItems = items.slice(i, i + sheet.cellsPerSheet);
    const page = Math.floor(i / sheet.cellsPerSheet);
    const cells: PaginatedCell[] = pageItems.map((item, idx) => {
      const col = idx % sheet.columns;
      const row = Math.floor(idx / sheet.columns);
      return {
        page,
        col,
        row,
        xMM: sheet.marginLeftMM + col * (sheet.cell.widthMM + sheet.colGapMM),
        yMM: sheet.marginTopMM + row * (sheet.cell.heightMM + sheet.rowGapMM),
        item,
      };
    });
    pages.push(cells);
  }
  return pages;
}

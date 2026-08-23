import { describe, expect, it } from "vitest";
import { AVERY_5160, AVERY_5163, paginate } from "./sheets";
import type { LabelItem, LabelTemplate } from "./types";

const template2x1_25: LabelTemplate = {
  id: "t", name: "t", category: "retail",
  size: { widthMM: 66.675, heightMM: 25.4 }, // matches AVERY_5160's cell exactly
  dualSided: false, bleedMM: 0, defaultSymbology: "CODE128", minDpi: 300, fields: [],
};

const template4x2: LabelTemplate = {
  id: "t2", name: "t2", category: "shipping",
  size: { widthMM: 101.6, heightMM: 50.8 }, // matches AVERY_5163's cell exactly
  dualSided: false, bleedMM: 0, defaultSymbology: "CODE128", minDpi: 300, fields: [],
};

function makeItems(n: number): LabelItem[] {
  return Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: `V${i}` }));
}

describe("Avery sheet layout constants", () => {
  it("AVERY_5160 sums exactly to a US Letter page (verified against Avery's published spec)", () => {
    const totalW = AVERY_5160.marginLeftMM * 2 + AVERY_5160.columns * AVERY_5160.cell.widthMM + (AVERY_5160.columns - 1) * AVERY_5160.colGapMM;
    const totalH = AVERY_5160.marginTopMM * 2 + AVERY_5160.rows * AVERY_5160.cell.heightMM + (AVERY_5160.rows - 1) * AVERY_5160.rowGapMM;
    expect(totalW).toBeCloseTo(AVERY_5160.pageSize.widthMM, 3);
    expect(totalH).toBeCloseTo(AVERY_5160.pageSize.heightMM, 3);
    expect(AVERY_5160.columns * AVERY_5160.rows).toBe(AVERY_5160.cellsPerSheet);
  });

  it("AVERY_5163 sums exactly to a US Letter page (best-effort constants - see sheets.ts)", () => {
    const totalW = AVERY_5163.marginLeftMM * 2 + AVERY_5163.columns * AVERY_5163.cell.widthMM + (AVERY_5163.columns - 1) * AVERY_5163.colGapMM;
    const totalH = AVERY_5163.marginTopMM * 2 + AVERY_5163.rows * AVERY_5163.cell.heightMM + (AVERY_5163.rows - 1) * AVERY_5163.rowGapMM;
    expect(totalW).toBeCloseTo(AVERY_5163.pageSize.widthMM, 3);
    expect(totalH).toBeCloseTo(AVERY_5163.pageSize.heightMM, 3);
    expect(AVERY_5163.columns * AVERY_5163.rows).toBe(AVERY_5163.cellsPerSheet);
  });
});

describe("paginate", () => {
  it("chunks items into cellsPerSheet-sized pages", () => {
    const pages = paginate(makeItems(35), AVERY_5160, template2x1_25);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(30);
    expect(pages[1]).toHaveLength(5);
  });

  it("computes correct col/row indices and positions for a 3-column sheet", () => {
    const pages = paginate(makeItems(4), AVERY_5160, template2x1_25);
    const cells = pages[0]!;
    expect(cells[0]).toMatchObject({ page: 0, col: 0, row: 0 });
    expect(cells[1]).toMatchObject({ page: 0, col: 1, row: 0 });
    expect(cells[2]).toMatchObject({ page: 0, col: 2, row: 0 });
    expect(cells[3]).toMatchObject({ page: 0, col: 0, row: 1 });
    // Row 1 starts exactly one cell-height + rowGap below row 0 (rowGap is 0 for 5160).
    expect(cells[3]!.yMM).toBeCloseTo(cells[0]!.yMM + AVERY_5160.cell.heightMM, 5);
    // Col 1 starts exactly one cell-width + colGap to the right of col 0.
    expect(cells[1]!.xMM).toBeCloseTo(cells[0]!.xMM + AVERY_5160.cell.widthMM + AVERY_5160.colGapMM, 5);
  });

  it("positions the first cell at the sheet's margin", () => {
    const pages = paginate(makeItems(1), AVERY_5160, template2x1_25);
    expect(pages[0]![0]!.xMM).toBeCloseTo(AVERY_5160.marginLeftMM, 5);
    expect(pages[0]![0]!.yMM).toBeCloseTo(AVERY_5160.marginTopMM, 5);
  });

  it("works for a 2-column sheet (Avery 5163)", () => {
    const pages = paginate(makeItems(3), AVERY_5163, template4x2);
    expect(pages[0]![0]).toMatchObject({ col: 0, row: 0 });
    expect(pages[0]![1]).toMatchObject({ col: 1, row: 0 });
    expect(pages[0]![2]).toMatchObject({ col: 0, row: 1 });
  });

  it("rejects a template whose size doesn't match the sheet's cell size", () => {
    const wrongTemplate: LabelTemplate = { ...template2x1_25, size: { widthMM: 999, heightMM: 999 } };
    expect(() => paginate(makeItems(1), AVERY_5160, wrongTemplate)).toThrow(/does not match/);
  });

  it("returns an empty array of pages for zero items", () => {
    expect(paginate([], AVERY_5160, template2x1_25)).toEqual([]);
  });
});

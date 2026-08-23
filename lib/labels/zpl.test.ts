import { describe, expect, it } from "vitest";
import { buildZplBatch, buildZplLabel } from "./zpl";

describe("buildZplLabel", () => {
  it("builds a Code128 label with correct page setup and field data", () => {
    const zpl = buildZplLabel({
      value: "Count01234567!", // BWIPP's own reference Code128 example
      symbology: "CODE128",
      widthMM: 50,
      heightMM: 25,
      dpi: 300,
    });
    // 50mm @ 300dpi = 590.55 -> 591 dots; 25mm @ 300dpi = 295.27 -> 295 dots
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("^PW591");
    expect(zpl).toContain("^LL295");
    expect(zpl).toContain("^BCN,");
    expect(zpl).toContain("^FDCount01234567!^FS");
    expect(zpl).toContain("^XZ");
  });

  it("builds an EAN-13 label via ^BE", () => {
    const zpl = buildZplLabel({
      value: "9520123456788",
      symbology: "EAN13",
      widthMM: 40,
      heightMM: 20,
    });
    expect(zpl).toContain("^BEN,");
    expect(zpl).toContain("^FD9520123456788^FS");
  });

  it("builds a UPC-A label via ^BU", () => {
    const zpl = buildZplLabel({ value: "012345000058", symbology: "UPCA", widthMM: 40, heightMM: 20 });
    expect(zpl).toContain("^BUN,");
  });

  it("builds an ITF-14 label via ^B2 (Interleaved 2-of-5)", () => {
    const zpl = buildZplLabel({ value: "09521234543213", symbology: "ITF14", widthMM: 100, heightMM: 60 });
    expect(zpl).toContain("^B2N,");
    expect(zpl).toContain("^FD09521234543213^FS");
  });

  it("builds a QR label via ^BQ with the eclevel+mask field-data prefix", () => {
    const zpl = buildZplLabel({
      value: "https://example.com",
      symbology: "QR",
      widthMM: 25,
      heightMM: 25,
      eclevel: "H",
    });
    expect(zpl).toContain("^BQN,2,");
    expect(zpl).toContain("^FDHA,https://example.com^FS");
  });

  it("builds a DataMatrix label via ^BX", () => {
    const zpl = buildZplLabel({ value: "ITEM-001", symbology: "DATAMATRIX", widthMM: 15, heightMM: 15 });
    expect(zpl).toContain("^BXN,");
    expect(zpl).toContain(",200\n^FDITEM-001^FS");
  });

  it("builds a Code39 label via ^B3", () => {
    const zpl = buildZplLabel({ value: "THIS IS CODE 39", symbology: "CODE39", widthMM: 60, heightMM: 20 });
    expect(zpl).toContain("^B3N,N,");
  });

  it("throws for EAN-8 - no standard ZPL command on typical Zebra firmware", () => {
    expect(() => buildZplLabel({ value: "95200002", symbology: "EAN8", widthMM: 30, heightMM: 15 })).toThrow(
      /EAN-8/,
    );
  });

  it("throws (never emits ZPL) for an invalid value", () => {
    expect(() =>
      buildZplLabel({ value: "9520123456780", symbology: "EAN13", widthMM: 40, heightMM: 20 }),
    ).toThrow(/check digit/);
  });

  it("scales module width with magnificationPct", () => {
    const at100 = buildZplLabel({ value: "9520123456788", symbology: "EAN13", widthMM: 40, heightMM: 20, magnificationPct: 100 });
    const at200 = buildZplLabel({ value: "9520123456788", symbology: "EAN13", widthMM: 40, heightMM: 20, magnificationPct: 200 });
    const bwAt100 = /\^BY(\d+)/.exec(at100)?.[1];
    const bwAt200 = /\^BY(\d+)/.exec(at200)?.[1];
    expect(Number(bwAt200)).toBeGreaterThan(Number(bwAt100));
  });
});

describe("buildZplBatch", () => {
  it("concatenates multiple ^XA...^XZ blocks", () => {
    const batch = buildZplBatch([
      { value: "9520123456788", symbology: "EAN13", widthMM: 40, heightMM: 20 },
      { value: "012345000058", symbology: "UPCA", widthMM: 40, heightMM: 20 },
    ]);
    expect(batch.match(/\^XA/g)).toHaveLength(2);
    expect(batch.match(/\^XZ/g)).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import { renderSymbology } from "./engine";

/** Extract width/height from the explicit mm attributes engine.ts stamps onto the root <svg>. */
function readMM(svg: string): { w: number; h: number } {
  const w = /width="([\d.]+)mm"/.exec(svg);
  const h = /height="([\d.]+)mm"/.exec(svg);
  return { w: w ? parseFloat(w[1]!) : NaN, h: h ? parseFloat(h[1]!) : NaN };
}

describe("renderSymbology", () => {
  it("rejects an invalid value before ever calling bwip-js", async () => {
    await expect(renderSymbology({ value: "9520123456780", symbology: "EAN13" })).rejects.toThrow(/check digit/);
  });

  it("EAN-13 at 100% magnification matches the GS1 nominal size (37.29 x 25.93mm)", async () => {
    const { svg, widthMM, heightMM } = await renderSymbology({
      value: "9520123456788",
      symbology: "EAN13",
      magnificationPct: 100,
    });
    expect(widthMM).toBeCloseTo(37.29, 2);
    expect(heightMM).toBeCloseTo(25.93, 2);
    const stamped = readMM(svg);
    expect(stamped.w).toBeCloseTo(37.29, 1);
    expect(stamped.h).toBeCloseTo(25.93, 1);
  });

  it("EAN-13 magnification scales linearly (200% is exactly double 100%)", async () => {
    const at100 = await renderSymbology({ value: "9520123456788", symbology: "EAN13", magnificationPct: 100 });
    const at200 = await renderSymbology({ value: "9520123456788", symbology: "EAN13", magnificationPct: 200 });
    expect(at200.widthMM).toBeCloseTo(at100.widthMM * 2, 5);
    expect(at200.heightMM).toBeCloseTo(at100.heightMM * 2, 5);
  });

  it("clamps magnification to the 80-200% range", async () => {
    const tooLow = await renderSymbology({ value: "9520123456788", symbology: "EAN13", magnificationPct: 10 });
    const at80 = await renderSymbology({ value: "9520123456788", symbology: "EAN13", magnificationPct: 80 });
    expect(tooLow.widthMM).toBeCloseTo(at80.widthMM, 5);

    const tooHigh = await renderSymbology({ value: "9520123456788", symbology: "EAN13", magnificationPct: 500 });
    const at200 = await renderSymbology({ value: "9520123456788", symbology: "EAN13", magnificationPct: 200 });
    expect(tooHigh.widthMM).toBeCloseTo(at200.widthMM, 5);
  });

  it("UPC-A and EAN-8 also hit their GS1 nominal sizes at 100%", async () => {
    const upca = await renderSymbology({ value: "012345000058", symbology: "UPCA" });
    expect(upca.widthMM).toBeCloseTo(36.3, 2);
    const ean8 = await renderSymbology({ value: "95200002", symbology: "EAN8" });
    expect(ean8.widthMM).toBeCloseTo(26.73, 2);
  });

  it("renders ITF-14 with its bearer box border (showborder default true)", async () => {
    const { svg, widthMM, heightMM } = await renderSymbology({ value: "09521234543213", symbology: "ITF14" });
    expect(svg.length).toBeGreaterThan(0);
    expect(widthMM).toBeGreaterThan(0);
    expect(heightMM).toBeGreaterThan(0);
  });

  it("renders QR with a custom error-correction level", async () => {
    const { svg, widthMM, heightMM } = await renderSymbology({
      value: "https://example.com",
      symbology: "QR",
      eclevel: "H",
    });
    expect(svg).toContain("<svg");
    expect(widthMM).toBeCloseTo(heightMM, 5); // QR is square
  });

  it("renders DataMatrix", async () => {
    const { svg } = await renderSymbology({ value: "ITEM-001-COMPACT", symbology: "DATAMATRIX" });
    expect(svg).toContain("<svg");
  });

  it("Code128 respects an explicit heightMM and preserves aspect ratio (no distortion)", async () => {
    const a = await renderSymbology({ value: "Count01234567!", symbology: "CODE128", heightMM: 10 });
    const b = await renderSymbology({ value: "Count01234567!", symbology: "CODE128", heightMM: 20 });
    expect(a.heightMM).toBeCloseTo(10, 5);
    expect(b.heightMM).toBeCloseTo(20, 5);
    // Doubling height should double width too (same aspect ratio, not stretched independently).
    expect(b.widthMM / b.heightMM).toBeCloseTo(a.widthMM / a.heightMM, 3);
  });
});

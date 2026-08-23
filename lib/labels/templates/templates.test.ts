import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate } from "./index";

const EXPECTED_IDS = [
  "retail-price-tag-2x1.25",
  "retail-price-tag-1.5x1",
  "apparel-hang-tag-2x3.5",
  "thermal-shipping-4x6",
  "master-carton-itf14-4x6",
  "master-carton-itf14-4x3",
  "warehouse-bin-3x1",
];

describe("template registry", () => {
  it("has all 7 required templates with unique ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of EXPECTED_IDS) expect(ids).toContain(id);
  });

  it("getTemplate resolves each registered id", () => {
    for (const id of EXPECTED_IDS) expect(getTemplate(id).id).toBe(id);
  });

  it("getTemplate throws for an unknown id", () => {
    expect(() => getTemplate("nonexistent")).toThrow(/Unknown label template/);
  });

  it("every field stays within its side's physical bounds (no field overflows the label)", () => {
    for (const t of TEMPLATES) {
      for (const f of t.fields) {
        expect(f.x + f.w, `${t.id}/${f.id} width overflow`).toBeLessThanOrEqual(t.size.widthMM + 0.01);
        expect(f.y + f.h, `${t.id}/${f.id} height overflow`).toBeLessThanOrEqual(t.size.heightMM + 0.01);
        expect(f.x, `${t.id}/${f.id} negative x`).toBeGreaterThanOrEqual(0);
        expect(f.y, `${t.id}/${f.id} negative y`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("dual-sided templates assign every field to a side; single-sided templates assign none", () => {
    for (const t of TEMPLATES) {
      for (const f of t.fields) {
        if (t.dualSided) expect(f.side, `${t.id}/${f.id} missing side`).toBeDefined();
        else expect(f.side, `${t.id}/${f.id} unexpected side`).toBeUndefined();
      }
    }
  });

  it("every template declares a defaultSymbology consistent with its category (ITF14 for carton templates)", () => {
    const cartonTemplates = TEMPLATES.filter((t) => t.category === "carton");
    expect(cartonTemplates.length).toBeGreaterThan(0);
    for (const t of cartonTemplates) expect(t.defaultSymbology).toBe("ITF14");
  });
});

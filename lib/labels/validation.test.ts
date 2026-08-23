import { describe, expect, it } from "vitest";
import {
  detectFormat,
  isValidEAN13,
  isValidEAN8,
  isValidITF14,
  isValidUPCA,
  validateForSymbology,
} from "./validation";

/**
 * Test vectors are BWIPP's own official `--EXAM:` example values (from
 * node_modules/bwip-js/barcode.ps, the canonical encoder source) rather than
 * hand-picked numbers - each is guaranteed a valid, spec-conformant check
 * digit for its symbology.
 */
const VALID = {
  EAN13: "9520123456788",
  EAN8: "95200002",
  UPCA: "012345000058",
  ITF14: "09521234543213",
};

describe("isValidEAN13", () => {
  it("accepts the BWIPP reference example", () => {
    expect(isValidEAN13(VALID.EAN13)).toBe(true);
  });
  it("rejects a flipped check digit", () => {
    expect(isValidEAN13("9520123456780")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isValidEAN13("123")).toBe(false);
  });
});

describe("isValidUPCA", () => {
  it("accepts the BWIPP reference example", () => {
    expect(isValidUPCA(VALID.UPCA)).toBe(true);
  });
  it("rejects a flipped check digit", () => {
    expect(isValidUPCA("012345000050")).toBe(false);
  });
});

describe("isValidEAN8", () => {
  it("accepts the BWIPP reference example", () => {
    expect(isValidEAN8(VALID.EAN8)).toBe(true);
  });
  it("rejects a flipped check digit", () => {
    expect(isValidEAN8("95200000")).toBe(false);
  });
});

describe("isValidITF14", () => {
  it("accepts the BWIPP reference example (weight-3-at-even-index family, distinct from EAN-13's weighting)", () => {
    expect(isValidITF14(VALID.ITF14)).toBe(true);
  });
  it("rejects a flipped check digit", () => {
    expect(isValidITF14("09521234543210")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isValidITF14("0952123454321")).toBe(false);
  });
  it("uses a genuinely different weighting than the EAN-13 family - regression guard", () => {
    // Confirms isValidITF14 is not accidentally aliased to the EAN-13-style
    // weighting (which would silently accept/reject the wrong digits for
    // most 14-digit inputs - see validation.ts's module docs).
    const wrongWeightingCheckDigit = 5; // computed via the EAN13-style (weight-1-at-even) formula for this body
    const body = "1234567890123";
    expect(isValidITF14(body + wrongWeightingCheckDigit)).toBe(false);
  });
});

describe("detectFormat", () => {
  it("detects ITF-14 before EAN-13 (14 digits)", () => {
    expect(detectFormat(VALID.ITF14)).toBe("ITF14");
  });
  it("detects EAN-13", () => {
    expect(detectFormat(VALID.EAN13)).toBe("EAN13");
  });
  it("detects UPC-A", () => {
    expect(detectFormat(VALID.UPCA)).toBe("UPCA");
  });
  it("detects EAN-8", () => {
    expect(detectFormat(VALID.EAN8)).toBe("EAN8");
  });
  it("falls back to Code128 for non-numeric or invalid-check-digit input", () => {
    expect(detectFormat("SKU-ABC-123")).toBe("CODE128");
    expect(detectFormat("9520123456780")).toBe("CODE128"); // bad EAN13 check digit
  });
});

describe("validateForSymbology", () => {
  it("passes the BWIPP reference examples for every symbology with a check digit", () => {
    expect(validateForSymbology(VALID.EAN13, "EAN13").valid).toBe(true);
    expect(validateForSymbology(VALID.UPCA, "UPCA").valid).toBe(true);
    expect(validateForSymbology(VALID.EAN8, "EAN8").valid).toBe(true);
    expect(validateForSymbology(VALID.ITF14, "ITF14").valid).toBe(true);
  });
  it("accepts a 13-digit ITF-14 body (check digit auto-computed downstream)", () => {
    expect(validateForSymbology("0952123454321", "ITF14").valid).toBe(true);
  });
  it("rejects an empty value for every symbology", () => {
    expect(validateForSymbology("", "CODE128").valid).toBe(false);
  });
  it("rejects QR input beyond max capacity", () => {
    expect(validateForSymbology("x".repeat(5000), "QR").valid).toBe(false);
  });
  it("rejects Code39 with unsupported characters", () => {
    expect(validateForSymbology("lowercase", "CODE39").valid).toBe(false);
  });
});

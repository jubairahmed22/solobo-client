import type { Symbology } from "./types";

/**
 * Validation - check digits, length, charset. Every render path (single-tag
 * generate, batch-import preview, sheet/PDF/ZPL export) goes through
 * `validateForSymbology` before a value is ever drawn - see engine.ts.
 */

/* ─────────────── GS1 check digits ─────────────── */

/**
 * GS1 mod-10 check digit for an EVEN-length code (EAN-13, UPC-A via a
 * leading-zero prefix) - i.e. an ODD number of data digits. The data digit
 * adjacent to the check digit always carries weight 3; for an odd count of
 * data digits that lands on an EVEN index counting from the left, which is
 * why this weights `i % 2 === 0 ? 1 : 3` (leftmost digit gets weight 1).
 * This does NOT generalise to EAN-8/ITF-14 - see `gs1CheckDigitOddDataCount`.
 */
function gs1CheckDigit(digits: string): number {
  const d = digits.replace(/\D/g, "").slice(0, -1);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    sum += parseInt(d.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * GS1 mod-10 check digit for an ODD-length code (EAN-8, ITF-14) - i.e. an
 * EVEN number of data digits, so the leftmost digit lands on weight 3
 * instead of 1 (opposite parity from `gs1CheckDigit` above). Verified
 * against ITF-14's official BWIPP test vector "0 952 1234 54321 3"
 * (09521234543213) - the two weighting schemes are NOT interchangeable and
 * diverge for most inputs, confirmed empirically during implementation.
 */
function gs1CheckDigitEvenDataCount(digits: string): number {
  const d = digits.replace(/\D/g, "").slice(0, -1);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    sum += parseInt(d.charAt(i)) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return parseInt(code.charAt(12)) === gs1CheckDigit(code);
}

export function isValidUPCA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  return isValidEAN13("0" + code);
}

export function isValidEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  return parseInt(code.charAt(7)) === gs1CheckDigitEvenDataCount(code);
}

/** ITF-14: 14 digits, 13-digit GTIN body + mod-10 check digit (same weighting family as EAN-8, not EAN-13). */
export function isValidITF14(code: string): boolean {
  if (!/^\d{14}$/.test(code)) return false;
  return parseInt(code.charAt(13)) === gs1CheckDigitEvenDataCount(code);
}

/* ─────────────── Charset/length-only checks (no check digit) ─────────────── */

export function isValidQrInput(value: string): boolean {
  return value.length > 0 && value.length <= 4296; // QR max capacity, low-density alphanumeric
}

export function isValidDataMatrixInput(value: string): boolean {
  return value.length > 0 && value.length <= 2335; // DataMatrix max byte capacity (ECC200)
}

export function isValidCode128Input(value: string): boolean {
  // Code128 covers the full ASCII range (0-127).
  return value.length > 0 && value.length <= 80 && /^[\x00-\x7F]*$/.test(value);
}

export function isValidCode39Input(value: string): boolean {
  return value.length > 0 && value.length <= 43 && /^[A-Z0-9\-. $/+%]*$/.test(value);
}

/* ─────────────── Auto-detect format ─────────────── */

export function detectFormat(value: string): Symbology {
  if (!value) return "CODE128";
  if (/^\d{14}$/.test(value) && isValidITF14(value)) return "ITF14";
  if (/^\d{13}$/.test(value) && isValidEAN13(value)) return "EAN13";
  if (/^\d{12}$/.test(value) && isValidUPCA(value)) return "UPCA";
  if (/^\d{8}$/.test(value) && isValidEAN8(value)) return "EAN8";
  return "CODE128";
}

/* ─────────────── Unified entry point ─────────────── */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * The one function every render path calls before drawing anything -
 * single-generate UI, batch-import preview, sheet/PDF/ZPL export. Never
 * silently renders a value that fails its symbology's check digit/length/
 * charset rules.
 */
export function validateForSymbology(value: string, symbology: Symbology): ValidationResult {
  const errors: string[] = [];
  if (!value) {
    return { valid: false, errors: ["Value is required"] };
  }

  switch (symbology) {
    case "EAN13":
      if (!/^\d{13}$/.test(value)) errors.push("EAN-13 must be exactly 13 digits");
      else if (!isValidEAN13(value)) errors.push("Invalid EAN-13 check digit");
      break;
    case "UPCA":
      if (!/^\d{12}$/.test(value)) errors.push("UPC-A must be exactly 12 digits");
      else if (!isValidUPCA(value)) errors.push("Invalid UPC-A check digit");
      break;
    case "EAN8":
      if (!/^\d{8}$/.test(value)) errors.push("EAN-8 must be exactly 8 digits");
      else if (!isValidEAN8(value)) errors.push("Invalid EAN-8 check digit");
      break;
    case "ITF14":
      if (!/^\d{13,14}$/.test(value)) errors.push("ITF-14 must be 13 or 14 digits (14th is the check digit)");
      else if (value.length === 14 && !isValidITF14(value)) errors.push("Invalid ITF-14 check digit");
      break;
    case "QR":
      if (!isValidQrInput(value)) errors.push("QR value is empty or exceeds max capacity (4296 characters)");
      break;
    case "DATAMATRIX":
      if (!isValidDataMatrixInput(value)) errors.push("DataMatrix value is empty or exceeds max capacity (2335 bytes)");
      break;
    case "CODE128":
      if (!isValidCode128Input(value)) errors.push("Code128 must be 1-80 ASCII characters");
      break;
    case "CODE39":
      if (!isValidCode39Input(value)) errors.push("Code39 supports only A-Z, 0-9, and - . $ / + % space (max 43 chars)");
      break;
  }

  return { valid: errors.length === 0, errors };
}

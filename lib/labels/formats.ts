import type { Symbology } from "./types";

export interface FormatMeta {
  id: Symbology;
  label: string;
  description: string;
  maxChars: number;
  numeric: boolean;
  /** GS1 retail symbology with a fixed 100%-magnification physical size (EAN13/UPCA/EAN8). */
  supportsMagnification: boolean;
}

export const BARCODE_FORMATS: FormatMeta[] = [
  {
    id: "CODE128",
    label: "Code 128",
    description: "Universal - letters, numbers, symbols. Auto A/B/C subset switching. Best for internal SKUs.",
    maxChars: 80,
    numeric: false,
    supportsMagnification: false,
  },
  {
    id: "EAN13",
    label: "EAN-13",
    description: "Retail standard (13 digits). Requires GS1 prefix for global use.",
    maxChars: 13,
    numeric: true,
    supportsMagnification: true,
  },
  {
    id: "UPCA",
    label: "UPC-A",
    description: "North American retail standard (12 digits).",
    maxChars: 12,
    numeric: true,
    supportsMagnification: true,
  },
  {
    id: "EAN8",
    label: "EAN-8",
    description: "Compact retail (8 digits). For small packaging.",
    maxChars: 8,
    numeric: true,
    supportsMagnification: true,
  },
  {
    id: "CODE39",
    label: "Code 39",
    description: "Older industrial standard - uppercase letters and digits only.",
    maxChars: 43,
    numeric: false,
    supportsMagnification: false,
  },
  {
    id: "ITF14",
    label: "ITF-14",
    description: "Interleaved 2-of-5, 14 digits. Master carton/case-level GTIN, printed with a bearer box.",
    maxChars: 14,
    numeric: true,
    supportsMagnification: false,
  },
  {
    id: "QR",
    label: "QR Code",
    description: "2D code - stores URLs, large text, or structured data. Configurable error correction.",
    maxChars: 4296,
    numeric: false,
    supportsMagnification: false,
  },
  {
    id: "DATAMATRIX",
    label: "DataMatrix",
    description: "Compact 2D code for small item tracking - higher density than QR at small sizes.",
    maxChars: 2335,
    numeric: false,
    supportsMagnification: false,
  },
];

export function getFormatMeta(symbology: Symbology): FormatMeta {
  const meta = BARCODE_FORMATS.find((f) => f.id === symbology);
  if (!meta) throw new Error(`Unknown symbology: ${symbology}`);
  return meta;
}

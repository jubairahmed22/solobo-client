/**
 * Type surface for the seller-facing bulk product import.
 *
 * Mirrors the shape returned by /api/seller/products/import/{preview,commit}.
 * The preview and commit responses share a per-row error/warning shape so
 * the same table component can render both - a row that failed at preview
 * looks the same as one that failed validation during commit.
 */

export interface ImportRowError {
  field: string;
  message: string;
}

/**
 * The "preview" projection of a valid row - enough information for the
 * seller to confirm the import is doing what they expect (right category,
 * right brand, image attached). Full payload stays server-side.
 */
export interface ImportResolvedRow {
  title: string;
  slug: string;
  price: number;
  stock: number;
  categoryName: string;
  brandName: string | null;
  imageCount: number;
  tagCount: number;
  isActive: boolean;
}

export interface ImportPreviewRow {
  rowIndex: number;
  raw: Record<string, string>;
  errors: ImportRowError[];
  warnings: ImportRowError[];
  resolved: ImportResolvedRow | null;
}

export interface ImportPreviewResponse {
  header: string[];
  /** Columns present in the CSV that the importer doesn't recognise. */
  unknownColumns: string[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ImportPreviewRow[];
}

export interface ImportCreatedRow {
  rowIndex: number;
  id: string;
  slug: string;
  title: string;
}

export interface ImportErroredRow {
  rowIndex: number;
  errors: ImportRowError[];
}

export interface ImportWriteFailure {
  rowIndex: number;
  message: string;
}

export interface ImportCommitResponse {
  totalRows: number;
  validCount: number;
  errorCount: number;
  createdCount: number;
  skippedCount: number;
  created: ImportCreatedRow[];
  erroredRows: ImportErroredRow[];
  writeFailures: ImportWriteFailure[];
}

export interface ImportRequestBody {
  csv: string;
  /**
   * Commit-only. When true, ignore errored rows and write the valid ones.
   * When false/omitted, the server refuses the whole import if any row
   * has validation errors.
   */
  skipErroredRows?: boolean;
}

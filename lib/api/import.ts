import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  ImportCommitResponse,
  ImportPreviewResponse,
  ImportRequestBody,
} from "@/types/import";

/**
 * Seller-facing bulk product import client. Two endpoints, both POST,
 * both take the raw CSV text in the body. Preview is read-only; commit
 * writes products owned by the requester.
 *
 * Error surface mirrors questionsApi / reviewsApi: a typed error class
 * that carries the response code + any field-level details so the
 * import page can show inline messages on the upload card.
 */

export class ImportError extends Error {
  code: string;
  fieldErrors?: Array<{ path: string; message: string }>;
  constructor(
    message: string,
    code: string,
    fieldErrors?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new ImportError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof ImportError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new ImportError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

export const importApi = {
  /**
   * Parse + validate without writing. Returns per-row outcomes so the
   * seller can confirm the file looks right before committing.
   */
  preview: (body: ImportRequestBody) =>
    unwrap<ImportPreviewResponse>(
      apiClient.post("/seller/products/import/preview", body),
    ),

  /**
   * Write valid rows as new products. By default refuses the whole
   * import if any row failed validation; pass `skipErroredRows: true`
   * to write the valid subset and skip the broken rows.
   */
  commit: (body: ImportRequestBody) =>
    unwrap<ImportCommitResponse>(
      apiClient.post("/seller/products/import/commit", body),
    ),
};

import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type { UploadResourceType, UploadResult, UploadScope } from "@/types/uploads";

/**
 * Uploads go to our own backend (`POST /api/uploads`), which stores them on
 * the VPS and returns a public URL plus a `publicId` used for deletion.
 */

export class UploadError extends Error {
  code: string;
  constructor(message: string, code = "UPLOAD_ERROR") {
    super(message);
    this.code = code;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new UploadError(res.data.message, res.data.code ?? "ERROR");
  } catch (err) {
    if (err instanceof UploadError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string };
      throw new UploadError(body.message ?? "Request failed", body.code ?? "ERROR");
    }
    if (axios.isAxiosError(err)) throw new UploadError(err.message || "Upload failed");
    throw err;
  }
}

export const uploadsApi = {
  /** Delete a stored file. Non-admins may only delete their own uploads. */
  destroy: (publicId: string, resourceType: UploadResourceType = "image") =>
    unwrap<{ publicId: string; result: string }>(
      apiClient.delete(`/uploads/${encodeURIComponent(publicId)}`, {
        params: resourceType === "video" ? { resourceType } : undefined,
      }),
    ),
};

/** Upload one file; `onProgress` receives 0-100. */
export function uploadFile(
  file: File,
  scope: UploadScope = "product",
  onProgress?: (pct: number) => void,
  resourceType: UploadResourceType = "image",
): Promise<UploadResult> {
  const form = new FormData();
  form.append("scope", scope);
  form.append("resourceType", resourceType);
  form.append("file", file);

  return unwrap<UploadResult>(
    apiClient.post("/uploads", form, {
      // The client defaults to JSON (which would serialise the FormData) and a
      // 15s timeout that phone uploads on mobile data can easily exceed.
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 0,
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }),
  );
}

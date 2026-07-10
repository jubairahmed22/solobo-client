import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  CloudinaryUploadResult,
  UploadScope,
  UploadSignature,
} from "@/types/uploads";

/**
 * Upload helpers for direct-to-Cloudinary uploads.
 *
 * Flow:
 *   1. `signUpload(scope)` - hits our backend to get a short-lived signature
 *      bound to a per-user folder.
 *   2. `uploadToCloudinary(file, signature, onProgress?)` - POSTs the file
 *      directly to Cloudinary's image upload URL with the signature.
 *   3. Caller stores the returned `secure_url` (and optionally `public_id`)
 *      against the resource (product, brand, …).
 *
 * Errors are normalised to `UploadError` so the UI doesn't have to know the
 * difference between a 4xx from our signing endpoint and a Cloudinary error.
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
    throw err;
  }
}

export const uploadsApi = {
  /**
   * Request a signed upload signature. `scope` decides the subfolder the
   * asset lands in on Cloudinary - defaults to "product".
   */
  sign: (scope: UploadScope = "product") =>
    unwrap<UploadSignature>(apiClient.post("/uploads/sign", { scope })),

  /**
   * Delete an asset by its Cloudinary public id. The backend enforces that
   * non-admins can only destroy assets inside their own per-user folder.
   *
   * publicId is path-encoded so slashes survive the URL round-trip.
   */
  destroy: (publicId: string) =>
    unwrap<{ publicId: string; result: string }>(
      apiClient.delete(`/uploads/${encodeURIComponent(publicId)}`),
    ),
};

/**
 * POST a single image file directly to Cloudinary using the provided
 * signature. Returns the relevant subset of Cloudinary's response.
 *
 * `onProgress` receives a 0-100 percentage so the UI can render a real
 * progress bar - useful since SME sellers on mobile data are often
 * uploading 2-5MB phone photos.
 */
export async function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress?: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  try {
    const res = await axios.post<CloudinaryUploadResult>(sig.uploadUrl, form, {
      // We're hitting Cloudinary directly here, so DON'T send our session
      // cookie or our axios interceptor - withCredentials stays off and we
      // use the bare axios import.
      withCredentials: false,
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const cloudErr = err.response?.data as
        | { error?: { message?: string } }
        | undefined;
      const message =
        cloudErr?.error?.message ?? err.message ?? "Upload failed";
      throw new UploadError(message, "CLOUDINARY_ERROR");
    }
    throw err;
  }
}

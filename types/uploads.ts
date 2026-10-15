export type UploadScope =
  | "product"
  | "brand"
  | "category"
  | "avatar"
  | "offer";

export type UploadResourceType = "image" | "video";

/** Response of `POST /api/uploads`. */
export interface UploadResult {
  url: string;
  /** Storage path on the server, used for deletion. */
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  originalFilename?: string;
}

/**
 * The shape products / brands / categories persist for each image. Mirrors
 * the backend Product `images` subdoc.
 */
export interface UploadedImage {
  url: string;
  alt?: string;
  /** Kept so removing an image can also delete the stored file. */
  publicId?: string;
}

/** The single optional product video. Mirrors the backend Product `video` subdoc. */
export interface UploadedVideo {
  url: string;
  publicId?: string;
  posterUrl?: string;
  duration?: number;
}

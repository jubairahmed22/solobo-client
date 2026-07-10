/**
 * Shapes for the Cloudinary direct-upload signing endpoint. The signature
 * lets the browser POST a file straight to Cloudinary without proxying it
 * through our Node process.
 *
 * `uploadUrl` is included so the frontend doesn't have to template the
 * Cloudinary URL itself - just POST FormData with the listed fields.
 */
export type UploadScope =
  | "product"
  | "brand"
  | "category"
  | "avatar"
  | "offer";

export interface UploadSignature {
  signature: string;
  timestamp: number;
  folder: string;
  apiKey: string;
  cloudName: string;
  uploadUrl: string;
}

/**
 * Subset of Cloudinary's image-upload response we actually use. Cloudinary
 * sends a lot more (resource_type, format, transformations, …) but we only
 * care about the public id (for deletes) and the secure URL (for storage).
 */
export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  original_filename?: string;
}

/**
 * The shape products / brands / categories persist for each image. Mirrors
 * the backend Product `images` subdoc.
 */
export interface UploadedImage {
  url: string;
  alt?: string;
  /**
   * Optional - we keep this around for "delete from Cloudinary on remove",
   * but it's not required by the backend product schema.
   */
  publicId?: string;
}

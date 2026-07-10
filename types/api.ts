/** Standard backend response envelope. Mirror this in src/utils/apiResponse.ts. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{ path: string; message: string }>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type Role = "guest" | "user" | "admin" | "superadmin";

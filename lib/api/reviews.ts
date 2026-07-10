import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  CreateReviewInput,
  ListReviewsParams,
  ListReviewsResponse,
  MyReviewResponse,
  Review,
  ToggleHelpfulResponse,
  UpdateReviewInput,
} from "@/types/reviews";

/**
 * Bespoke error class so React Query mutations can branch on `code` and
 * surface field-level Zod errors back to RHF (mirrors UsersError pattern).
 */
export class ReviewsError extends Error {
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
    throw new ReviewsError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof ReviewsError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new ReviewsError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

/**
 * Same idea as `unwrap`, but for the list endpoint we want the meta block
 * (pagination) too. The backend response envelope places it on the outer
 * object, so we read the raw response here instead of unwrapping early.
 */
async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  try {
    const res = await promise;
    if (res.data.success) return { data: res.data.data, meta: res.data.meta };
    throw new ReviewsError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof ReviewsError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new ReviewsError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

export const reviewsApi = {
  list: (params: ListReviewsParams = {}) =>
    unwrapWithMeta<ListReviewsResponse>(
      apiClient.get("/reviews", { params }),
    ),

  getMine: (productId: string) =>
    unwrap<MyReviewResponse>(
      apiClient.get("/reviews/mine", { params: { productId } }),
    ),

  create: (input: CreateReviewInput) =>
    unwrap<{ review: Review }>(apiClient.post("/reviews", input)),

  update: (id: string, input: UpdateReviewInput) =>
    unwrap<{ review: Review }>(apiClient.patch(`/reviews/${id}`, input)),

  remove: (id: string) =>
    unwrap<{ message: string }>(apiClient.delete(`/reviews/${id}`)),

  toggleHelpful: (id: string) =>
    unwrap<ToggleHelpfulResponse>(apiClient.post(`/reviews/${id}/helpful`)),
};

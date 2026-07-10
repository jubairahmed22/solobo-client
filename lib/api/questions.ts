import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  AnswerQuestionInput,
  CreateQuestionInput,
  ListProductQuestionsParams,
  ListProductQuestionsResponse,
  Question,
} from "@/types/questions";

/**
 * Storefront-facing Q&A client. Mirrors the reviews API: a typed error so
 * mutations can surface Zod field errors back to RHF, plus `unwrap` /
 * `unwrapWithMeta` helpers that keep the call sites readable.
 *
 * Admin moderation lives on `adminApi` (separate concern, different envelope
 * expectations once we add bulk ops).
 */
export class QuestionsError extends Error {
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
    throw new QuestionsError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof QuestionsError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new QuestionsError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  try {
    const res = await promise;
    if (res.data.success) return { data: res.data.data, meta: res.data.meta };
    throw new QuestionsError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (err instanceof QuestionsError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new QuestionsError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

export const questionsApi = {
  listForProduct: (productId: string, params: ListProductQuestionsParams = {}) =>
    unwrapWithMeta<ListProductQuestionsResponse>(
      apiClient.get(`/products/${productId}/questions`, { params }),
    ),

  ask: (productId: string, input: CreateQuestionInput) =>
    unwrap<Question>(apiClient.post(`/products/${productId}/questions`, input)),

  /** Answer a question - only the product owner or an admin may do this server-side. */
  answer: (questionId: string, input: AnswerQuestionInput) =>
    unwrap<Question>(apiClient.post(`/questions/${questionId}/answers`, input)),

  /** Delete one answer - author or admin only on the backend. */
  deleteAnswer: (questionId: string, answerId: string) =>
    unwrap<{ id: string; answerId: string }>(
      apiClient.delete(`/questions/${questionId}/answers/${answerId}`),
    ),
};

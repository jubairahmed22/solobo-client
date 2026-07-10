"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { questionsApi } from "@/lib/api/questions";
import type {
  AnswerQuestionInput,
  CreateQuestionInput,
  ListProductQuestionsParams,
} from "@/types/questions";

/**
 * Storefront Q&A hooks. Mirrors `useReviews` - paginated query keyed by
 * product id + params, mutations invalidate every list for that product so
 * the PDP rerenders with the latest state.
 *
 * Why all-questions invalidation rather than the specific key on each
 * mutation: the page lists rows by createdAt desc and a new question/answer
 * shifts pagination. Refetching all pages is the safest way to stay
 * consistent without bookkeeping.
 */
export const questionsKeys = {
  all: ["questions"] as const,
  forProduct: (productId: string, params: ListProductQuestionsParams) =>
    ["questions", "product", productId, params] as const,
  forProductAll: (productId: string) =>
    ["questions", "product", productId] as const,
};

export function useProductQuestions(
  productId: string | undefined,
  params: ListProductQuestionsParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: questionsKeys.forProduct(productId ?? "", params),
    queryFn: () => questionsApi.listForProduct(productId as string, params),
    enabled: enabled && Boolean(productId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

function useInvalidateProductQuestions() {
  const qc = useQueryClient();
  return (productId: string) => {
    qc.invalidateQueries({ queryKey: questionsKeys.forProductAll(productId) });
  };
}

/** Ask a question - auth-gated server-side. */
export function useAskQuestion(productId: string) {
  const invalidate = useInvalidateProductQuestions();
  return useMutation({
    mutationFn: (input: CreateQuestionInput) =>
      questionsApi.ask(productId, input),
    onSuccess: () => invalidate(productId),
  });
}

/**
 * Answer a question. Server validates the actor is the product owner or an
 * admin; the UI hides the form for everyone else so we don't expect this to
 * 403 in practice, but the auth check on the server is the canonical guard.
 */
export function useAnswerQuestion(productId: string) {
  const invalidate = useInvalidateProductQuestions();
  return useMutation({
    mutationFn: ({
      questionId,
      input,
    }: {
      questionId: string;
      input: AnswerQuestionInput;
    }) => questionsApi.answer(questionId, input),
    onSuccess: () => invalidate(productId),
  });
}

export function useDeleteAnswer(productId: string) {
  const invalidate = useInvalidateProductQuestions();
  return useMutation({
    mutationFn: ({
      questionId,
      answerId,
    }: {
      questionId: string;
      answerId: string;
    }) => questionsApi.deleteAnswer(questionId, answerId),
    onSuccess: () => invalidate(productId),
  });
}

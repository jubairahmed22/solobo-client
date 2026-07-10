"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api/reviews";
import type {
  CreateReviewInput,
  ListReviewsParams,
  UpdateReviewInput,
} from "@/types/reviews";

/**
 * Query keys grouped by surface so invalidations after a mutation can fan
 * out to every list view (product page, account, etc) without manual
 * tracking.
 */
export const reviewsKeys = {
  all: ["reviews"] as const,
  list: (params: ListReviewsParams) => ["reviews", "list", params] as const,
  mine: (productId: string) => ["reviews", "mine", productId] as const,
};

export function useReviewList(params: ListReviewsParams, enabled = true) {
  return useQuery({
    queryKey: reviewsKeys.list(params),
    queryFn: () => reviewsApi.list(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useMyReview(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: reviewsKeys.mine(productId ?? ""),
    queryFn: () => reviewsApi.getMine(productId as string),
    enabled: enabled && Boolean(productId),
    staleTime: 30_000,
  });
}

/**
 * Invalidate every list query plus the matching `mine` cache after a write
 * so the product page rerenders with the latest counts and ordering.
 */
function useInvalidateProductReviews() {
  const qc = useQueryClient();
  return (productId: string) => {
    qc.invalidateQueries({ queryKey: ["reviews"] });
    qc.invalidateQueries({ queryKey: reviewsKeys.mine(productId) });
  };
}

export function useCreateReview() {
  const invalidate = useInvalidateProductReviews();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => reviewsApi.create(input),
    onSuccess: (_data, vars) => invalidate(vars.productId),
  });
}

export function useUpdateReview(productId: string) {
  const invalidate = useInvalidateProductReviews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReviewInput }) =>
      reviewsApi.update(id, input),
    onSuccess: () => invalidate(productId),
  });
}

export function useDeleteReview(productId: string) {
  const invalidate = useInvalidateProductReviews();
  return useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: () => invalidate(productId),
  });
}

export function useToggleHelpful(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewsApi.toggleHelpful(id),
    onSuccess: () => {
      // List queries cache the helpfulCount, so refresh those. We deliberately
      // don't touch `mine` - voting on your own review is blocked server-side.
      qc.invalidateQueries({ queryKey: ["reviews", "list"] });
      // also invalidate the product detail cache in case it embeds a summary
      qc.invalidateQueries({ queryKey: ["product", productId] });
    },
  });
}

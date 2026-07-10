/**
 * Shape of a review object as returned by GET /api/reviews. The backend's
 * `publicReview()` helper inlines a small slice of the user document so the
 * UI doesn't need a second call to render the reviewer's name + avatar.
 */
export interface ReviewUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface Review {
  _id: string;
  product: string;
  user: ReviewUser;
  order?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
  isApproved: boolean;
  helpfulCount: number;
  /** Computed by the backend from the presence of `order`. */
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Aggregated rating breakdown returned alongside the review list when a
 * `productId` filter is supplied. Lets product pages render the histogram
 * without a second round-trip.
 */
export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ListReviewsResponse {
  reviews: Review[];
  summary: ReviewSummary | null;
}

export interface MyReviewResponse {
  review: Review | null;
  /** True if the user has either a delivered order OR an existing review. */
  canReview: boolean;
  /** True only when the user has a delivered order - drives the "verified" badge. */
  verifiedPurchase: boolean;
}

export type ReviewSort = "newest" | "oldest" | "helpful" | "rating-desc" | "rating-asc";

export interface ListReviewsParams {
  productId?: string;
  user?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  page?: number;
  limit?: number;
  sort?: ReviewSort;
}

export interface CreateReviewInput {
  productId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
}

export interface UpdateReviewInput {
  rating?: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
}

export interface ToggleHelpfulResponse {
  helpfulCount: number;
  voted: boolean;
}

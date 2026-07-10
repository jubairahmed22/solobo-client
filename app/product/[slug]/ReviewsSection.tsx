"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThumbsUp, BadgeCheck, Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Avatar, Badge, Button, Input, Label, Spinner } from "@/components/ui";
import { Pagination, RatingStars, Select } from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils/cn";
import {
  useCreateReview,
  useDeleteReview,
  useMyReview,
  useReviewList,
  useToggleHelpful,
  useUpdateReview,
} from "@/hooks/useReviews";
import { ReviewsError } from "@/lib/api/reviews";
import type { Review, ReviewSort, ReviewSummary } from "@/types/reviews";

/* ───────────────────── Form ───────────────────── */

const reviewFormSchema = z.object({
  rating: z.number().int().min(1, "Pick a rating").max(5),
  title: z.string().trim().max(120, "Keep it under 120 characters").optional(),
  body: z.string().trim().max(4000, "Keep it under 4000 characters").optional(),
});
type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface WriteReviewProps {
  productId: string;
  existing: Review | null;
  verifiedPurchase: boolean;
}

function WriteReview({ productId, existing, verifiedPurchase }: WriteReviewProps) {
  const toast = useUIStore((s) => s.toast);
  const createMutation = useCreateReview();
  const updateMutation = useUpdateReview(productId);
  const deleteMutation = useDeleteReview(productId);

  const isEdit = Boolean(existing);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: existing?.rating ?? 0,
      title: existing?.title ?? "",
      body: existing?.body ?? "",
    },
  });

  // RHF caches defaults - when `existing` swaps in/out (login, refetch) we
  // need to reset the form to track the new source of truth.
  React.useEffect(() => {
    form.reset({
      rating: existing?.rating ?? 0,
      title: existing?.title ?? "",
      body: existing?.body ?? "",
    });
  }, [existing, form]);

  const ratingValue = form.watch("rating");

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing._id,
          input: {
            rating: values.rating as 1 | 2 | 3 | 4 | 5,
            title: values.title ?? "",
            body: values.body ?? "",
          },
        });
        toast({ title: "Review updated", tone: "success" });
      } else {
        await createMutation.mutateAsync({
          productId,
          rating: values.rating as 1 | 2 | 3 | 4 | 5,
          title: values.title || undefined,
          body: values.body || undefined,
        });
        toast({ title: "Thanks for your review!", tone: "success" });
        form.reset({ rating: 0, title: "", body: "" });
      }
    } catch (err) {
      const message =
        err instanceof ReviewsError ? err.message : "Couldn't save your review";
      toast({ title: message, tone: "error" });
    }
  });

  const onDelete = async () => {
    if (!existing) return;
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync(existing._id);
      toast({ title: "Review removed", tone: "success" });
      form.reset({ rating: 0, title: "", body: "" });
    } catch (err) {
      const message =
        err instanceof ReviewsError ? err.message : "Couldn't remove the review";
      toast({ title: message, tone: "error" });
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-paper p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">
          {isEdit ? "Edit your review" : "Write a review"}
        </h3>
        {verifiedPurchase ? (
          <Badge variant="outline" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified purchase
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="rv-rating">Your rating</Label>
        <RatingStars
          value={ratingValue ?? 0}
          size="lg"
          onChange={(v) => form.setValue("rating", v, { shouldValidate: true })}
        />
        {form.formState.errors.rating ? (
          <p className="text-xs text-red-600">{form.formState.errors.rating.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="rv-title">Title (optional)</Label>
        <Input id="rv-title" placeholder="Sums up your experience" {...form.register("title")} />
        {form.formState.errors.title ? (
          <p className="text-xs text-red-600">{form.formState.errors.title.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="rv-body">Details (optional)</Label>
        <textarea
          id="rv-body"
          rows={4}
          className="w-full rounded-lg border border-neutral-300 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-neutral-400 focus:border-ink focus:outline-none"
          placeholder="What did you like or dislike? How did it perform?"
          {...form.register("body")}
        />
        {form.formState.errors.body ? (
          <p className="text-xs text-red-600">{form.formState.errors.body.message}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isEdit ? "Save changes" : "Submit review"}
        </Button>
        {isEdit ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="ml-1">Delete</span>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/* ───────────────────── Summary panel ───────────────────── */

interface SummaryPanelProps {
  productId: string;
  fallbackAverage: number;
  fallbackCount: number;
  summary: ReviewSummary | null;
  ratingFilter: number | null;
  onFilterChange: (rating: number | null) => void;
}

function SummaryPanel({
  fallbackAverage,
  fallbackCount,
  summary,
  ratingFilter,
  onFilterChange,
}: SummaryPanelProps) {
  const average = summary?.average ?? fallbackAverage;
  const count = summary?.count ?? fallbackCount;
  const distribution = summary?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const max = Math.max(1, count);

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-paper p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <span className="text-4xl font-bold text-ink">{average.toFixed(1)}</span>
        <RatingStars value={average} size="md" />
        <span className="text-sm text-neutral-500">
          Based on {count.toLocaleString("en-US")} {count === 1 ? "review" : "reviews"}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const value = distribution[star as 1 | 2 | 3 | 4 | 5];
          const pct = count > 0 ? (value / max) * 100 : 0;
          const active = ratingFilter === star;
          return (
            <li key={star}>
              <button
                type="button"
                onClick={() => onFilterChange(active ? null : star)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                  active ? "bg-neutral-100" : "hover:bg-neutral-50",
                )}
                aria-pressed={active}
              >
                <span className="w-8 text-xs font-medium text-neutral-700">{star}★</span>
                <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 text-right text-xs tabular-nums text-neutral-600">
                  {value}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {ratingFilter !== null ? (
        <button
          type="button"
          onClick={() => onFilterChange(null)}
          className="mt-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          Clear filter
        </button>
      ) : null}
    </aside>
  );
}

/* ───────────────────── Review row ───────────────────── */

interface ReviewRowProps {
  review: Review;
  productId: string;
  isOwn: boolean;
  isAuthed: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function ReviewRow({ review, productId, isOwn, isAuthed }: ReviewRowProps) {
  const toast = useUIStore((s) => s.toast);
  const helpful = useToggleHelpful(productId);
  const [voted, setVoted] = React.useState(false);

  const onHelpful = async () => {
    if (!isAuthed) {
      toast({ title: "Sign in to mark reviews as helpful", tone: "info" });
      return;
    }
    if (isOwn) {
      toast({ title: "You can't vote on your own review", tone: "info" });
      return;
    }
    try {
      const res = await helpful.mutateAsync(review._id);
      setVoted(res.voted);
    } catch (err) {
      const message = err instanceof ReviewsError ? err.message : "Couldn't save vote";
      toast({ title: message, tone: "error" });
    }
  };

  return (
    <article className="flex flex-col gap-2.5 border-b border-neutral-100 py-5 last:border-b-0">
      <header className="flex items-start gap-3">
        <Avatar src={review.user.avatar} alt={review.user.name} size={40} />
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-ink">{review.user.name}</span>
            {review.isVerifiedPurchase ? (
              <Badge variant="outline" className="gap-1">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
              </Badge>
            ) : null}
            {isOwn ? (
              <Badge variant="muted">Your review</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <RatingStars value={review.rating} size="sm" />
            <span>·</span>
            <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
          </div>
        </div>
      </header>

      {review.title ? (
        <h4 className="text-sm font-semibold text-ink">{review.title}</h4>
      ) : null}
      {review.body ? (
        <p className="whitespace-pre-line text-sm text-neutral-700">{review.body}</p>
      ) : null}

      <div className="mt-1 flex items-center">
        <button
          type="button"
          onClick={onHelpful}
          disabled={helpful.isPending || isOwn}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            voted
              ? "border-ink bg-ink text-paper"
              : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50",
            (helpful.isPending || isOwn) && "opacity-60",
          )}
          aria-pressed={voted}
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          Helpful ({review.helpfulCount})
        </button>
      </div>
    </article>
  );
}

/* ───────────────────── Main section ───────────────────── */

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "helpful", label: "Most helpful" },
  { value: "rating-desc", label: "Highest rated" },
  { value: "rating-asc", label: "Lowest rated" },
];

export interface ReviewsSectionProps {
  productId: string;
  /** From the product document - used as a fallback before the list query resolves. */
  fallbackAverage: number;
  fallbackCount: number;
  className?: string;
}

export function ReviewsSection({
  productId,
  fallbackAverage,
  fallbackCount,
  className,
}: ReviewsSectionProps) {
  const { status, data: session } = useSession();
  const isAuthed = status === "authenticated";
  const userId = session?.user?.id;
  const pathname = usePathname();

  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<ReviewSort>("newest");
  const [ratingFilter, setRatingFilter] = React.useState<number | null>(null);

  const listParams = React.useMemo(
    () => ({
      productId,
      page,
      limit: 5,
      sort,
      rating: (ratingFilter ?? undefined) as 1 | 2 | 3 | 4 | 5 | undefined,
    }),
    [productId, page, sort, ratingFilter],
  );

  const listQuery = useReviewList(listParams);
  const myQuery = useMyReview(productId, isAuthed);

  const reviews = listQuery.data?.data.reviews ?? [];
  const summary = listQuery.data?.data.summary ?? null;
  const meta = listQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // Reset to page 1 whenever the filter or sort changes so the user sees the
  // top of the new list, not page N of stale results.
  React.useEffect(() => {
    setPage(1);
  }, [sort, ratingFilter]);

  return (
    <section className={cn("flex flex-col gap-5", className)} id="reviews">
      <header className="flex flex-wrap items-end justify-between gap-1">
        <div>
          <h2 className="text-xl font-bold text-ink">Customer reviews</h2>
          <p className="text-sm text-neutral-600">
            What buyers are saying about this product.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <SummaryPanel
          productId={productId}
          fallbackAverage={fallbackAverage}
          fallbackCount={fallbackCount}
          summary={summary}
          ratingFilter={ratingFilter}
          onFilterChange={setRatingFilter}
        />

        <div className="flex flex-col gap-4">
          {/* Compose / sign-in prompt */}
          {status === "loading" ? (
            <div className="flex items-center justify-center rounded-xl border border-neutral-200 p-4">
              <Spinner />
            </div>
          ) : isAuthed ? (
            myQuery.isLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-neutral-200 p-4">
                <Spinner />
              </div>
            ) : myQuery.data?.canReview ? (
              <WriteReview
                productId={productId}
                existing={myQuery.data.review}
                verifiedPurchase={myQuery.data.verifiedPurchase}
              />
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-paper p-4 text-sm text-neutral-700">
                Reviews are open only to customers who've received this product.
                Once your order is delivered, come back here to share your experience.
              </div>
            )
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-paper p-4">
              <p className="text-sm text-neutral-700">
                Sign in to write a review for this product.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`${pathname ?? "/"}#reviews`)}`}
              >
                <Button variant="secondary">Sign in</Button>
              </Link>
            </div>
          )}

          {/* Sort + filter row */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
            <span className="text-sm text-neutral-500">
              {ratingFilter !== null
                ? `Filtered by ${ratingFilter}★`
                : meta
                  ? `${meta.total.toLocaleString("en-US")} ${
                      meta.total === 1 ? "review" : "reviews"
                    }`
                  : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="rv-sort" className="text-xs text-neutral-600">
                Sort
              </Label>
              <Select
                id="rv-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as ReviewSort)}
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          {/* List */}
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Spinner />
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-paper py-8 text-center text-sm text-neutral-500">
              {ratingFilter !== null
                ? "No reviews match this filter yet."
                : "No reviews yet - be the first to share your thoughts."}
            </div>
          ) : (
            <ul className="flex flex-col">
              {reviews.map((r) => (
                <li key={r._id}>
                  <ReviewRow
                    review={r}
                    productId={productId}
                    isAuthed={isAuthed}
                    isOwn={Boolean(userId) && r.user.id === userId}
                  />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              className="mt-2"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

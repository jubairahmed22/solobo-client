"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, BadgeCheck, Check, EyeOff, Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { Avatar, Button, Spinner } from "@/components/ui";
import { Pagination, RatingStars, Select } from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils/cn";
import { useAdminReviews, useApproveReview, useDeleteAdminReview, useHideReview } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminListReviewsParams, AdminReview, AdminReviewStatus } from "@/types/admin";

const STATUS_OPTIONS: { value: AdminReviewStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
];

const RATING_OPTIONS = [
  { value: "", label: "All ratings" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

const SORT_OPTIONS: { value: "newest" | "oldest"; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function ReviewRow({ review }: { review: AdminReview }) {
  const toast = useUIStore((s) => s.toast);
  const approve = useApproveReview();
  const hide = useHideReview();
  const remove = useDeleteAdminReview();
  const busy = approve.isPending || hide.isPending || remove.isPending;

  const onApprove = async () => {
    try {
      await approve.mutateAsync(review._id);
      toast({ title: "Review approved", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't approve", tone: "error" }); }
  };
  const onHide = async () => {
    try {
      await hide.mutateAsync(review._id);
      toast({ title: "Review hidden", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't hide", tone: "error" }); }
  };
  const onDelete = async () => {
    if (!window.confirm("Permanently delete this review? This cannot be undone.")) return;
    try {
      await remove.mutateAsync(review._id);
      toast({ title: "Review deleted", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't delete", tone: "error" }); }
  };

  return (
    <article className="flex flex-col gap-3 border-b border-neutral-100 py-4 last:border-b-0">
      <header className="flex items-start gap-3">
        <Avatar src={review.user?.avatar} alt={review.user?.name ?? "Unknown"} size={32} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-ink">{review.user?.name ?? "Unknown user"}</span>
            {review.user?.email ? <span className="text-xs text-neutral-500">({review.user.email})</span> : null}
            {review.isVerifiedPurchase ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                <BadgeCheck className="h-2.5 w-2.5" aria-hidden /> Verified
              </span>
            ) : null}
            <span className={cn(
              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
              review.isApproved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
            )}>
              {review.isApproved ? "Approved" : "Pending"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <RatingStars value={review.rating} size="sm" />
            <span>·</span>
            <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
            {review.product ? (
              <>
                <span>·</span>
                <Link href={`/product/${review.product.slug}`} className="truncate hover:underline" target="_blank" rel="noreferrer">
                  {review.product.title}
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {review.title ? <h4 className="text-sm font-semibold text-ink">{review.title}</h4> : null}
      {review.body ? (
        <p className="whitespace-pre-line text-sm text-neutral-700">{review.body}</p>
      ) : (
        <p className="text-xs italic text-neutral-500">No written details.</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {review.isApproved ? (
          <Button size="sm" variant="secondary" onClick={onHide} disabled={busy}>
            {hide.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
            <span className="ml-1">Hide</span>
          </Button>
        ) : (
          <Button size="sm" onClick={onApprove} disabled={busy}>
            {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            <span className="ml-1">Approve</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
          {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          <span className="ml-1">Delete</span>
        </Button>
      </div>
    </article>
  );
}

export function ReviewsModerationClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = (search.get("status") ?? "all") as AdminReviewStatus;
  const ratingRaw = search.get("rating");
  const rating = ratingRaw && /^[1-5]$/.test(ratingRaw) ? (Number(ratingRaw) as 1 | 2 | 3 | 4 | 5) : undefined;
  const sort = (search.get("sort") ?? "newest") as "newest" | "oldest";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k); else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const params: AdminListReviewsParams = React.useMemo(
    () => ({ status, rating, sort, page, limit: 20 }),
    [status, rating, sort, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminReviews(params);
  const reviews = data?.data.reviews ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = status !== "all" || Boolean(rating) || sort !== "newest";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Reviews</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Approve, hide, or remove reviews. Hidden reviews stay in the database but disappear from product pages and rating averages.</p>
        </div>
        {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Status</span>
          <Select value={status} onChange={(e) => update({ status: e.target.value })} options={STATUS_OPTIONS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Rating</span>
          <Select value={rating ? String(rating) : ""} onChange={(e) => update({ rating: e.target.value || undefined })} options={RATING_OPTIONS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Sort</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value })} options={SORT_OPTIONS} />
        </div>
        {filtersActive ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink">
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load reviews."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <MessageSquare className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">No reviews match these filters.</p>
        </div>
      ) : (
        <div className="rounded-sm border border-neutral-200 bg-paper px-3">
          <ul>
            {reviews.map((r) => <li key={r._id}><ReviewRow review={r} /></li>)}
          </ul>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}
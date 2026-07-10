"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, AlertTriangle } from "lucide-react";
import { ProductCard, ProductCardSkeleton, Pagination } from "@/components/composed";
import { useSellerStore } from "@/hooks/useCatalog";
import type { PaginationMeta } from "@/types/api";
import type { PublicSellerStore } from "@/types/catalog";

export interface StoreClientProps {
  initial: PublicSellerStore;
  initialMeta?: PaginationMeta;
  slug: string;
  initialPage: number;
  pageSize: number;
}

/**
 * Public storefront UI. The page server-rendered the first page (so SEO +
 * fast first paint are covered); this client component takes over for
 * pagination, refetching via React Query when `?page=` changes.
 *
 * Suspended sellers come back with an empty products array and a flag - we
 * render a polite notice instead of an empty grid in that case.
 */
export function StoreClient({
  initial,
  initialMeta,
  slug,
  initialPage,
  pageSize,
}: StoreClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const isInitialPage = page === initialPage;
  const query = useSellerStore(slug, page, pageSize);

  const data = isInitialPage && !query.data ? initial : query.data?.data ?? initial;
  const meta =
    isInitialPage && !query.data ? initialMeta : query.data?.meta ?? initialMeta;
  const isLoading = query.isLoading && !isInitialPage;

  const { profile, products } = data;
  const isSuspended = profile.isSuspended;

  const onPageChange = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    router.push(`/store/${slug}${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mt-2 flex flex-col gap-4">
      {/* Profile header */}
      <header className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-paper p-4 sm:p-5">
        <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 sm:h-[64px] sm:w-[64px]">
          {profile.avatar ? (
            <Image
              src={profile.avatar}
              alt={profile.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink">
              <Store className="h-4 w-4" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Shop</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {profile.name}
          </h1>
          {profile.storeBio ? (
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-700">{profile.storeBio}</p>
          ) : null}
          <p className="text-xs text-neutral-500">
            Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
            })}
            {meta && meta.total !== undefined ? (
              <>
                {" · "}
                {meta.total} {meta.total === 1 ? "product" : "products"}
              </>
            ) : null}
          </p>
        </div>
      </header>

      {/* Suspended notice */}
      {isSuspended ? (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="font-medium">This shop is currently unavailable.</p>
            <p className="mt-1 text-neutral-700">
              The seller is paused. Their products are temporarily hidden - please
              check back later.
            </p>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-paper p-6 text-center">
          <p className="text-base font-medium">No products yet.</p>
          <p className="mt-1 text-sm text-neutral-600">
            This shop hasn&apos;t listed anything yet.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="flex flex-col">
                    <ProductCardSkeleton className="h-full w-full" />
                  </li>
                ))
              : products.map((p) => (
                  <li key={p._id} className="flex flex-col">
                    <ProductCard product={p} className="h-full w-full" />
                  </li>
                ))}
          </ul>

          {meta && meta.totalPages > 1 ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={onPageChange}
              className="mt-2"
            />
          ) : null}
        </>
      )}
    </div>
  );
}

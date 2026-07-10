"use client";

import * as React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui";
import { buttonVariants } from "@/components/ui/Button";
import { ProductCard, ProductRow } from "@/components/composed";
import { useWishlistStore, type WishlistItem } from "@/store/wishlistStore";
import { useProducts } from "@/hooks/useCatalog";
import type { ProductSummary } from "@/types/catalog";

/**
 * WishlistClient - saved products rendered with the SAME storefront ProductCard
 * + grid as the homepage/all-products, directly on the grey page. The card's
 * own heart toggles the wishlist (so the filled heart removes
 * it) and the card's Add-to-cart works as everywhere else. A "You might also
 * like" row mirrors the homepage sections so the page never feels empty.
 *
 * Wishlist data is local (Zustand + localStorage). We hold a minimal snapshot
 * per item, so we adapt it into the ProductSummary shape ProductCard expects.
 */

function toSummary(item: WishlistItem): ProductSummary {
  return {
    _id: item.productId,
    title: item.title,
    slug: item.slug,
    price: item.price,
    currency: "BDT",
    // We don't snapshot stock; assume available so the card stays actionable.
    stock: 1,
    images: item.image ? [{ url: item.image, alt: item.title }] : [],
    ratingAverage: 0,
    ratingCount: 0,
    isFeatured: false,
    category: "",
  } as ProductSummary;
}

export function WishlistClient() {
  const items = useWishlistStore((s) => s.items);
  const clear = useWishlistStore((s) => s.clear);

  // Avoid a hydration flash - the persisted store rehydrates after first paint.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  // Recommendations - newest products, minus anything already saved.
  const { data: recResp } = useProducts({ sort: "newest", limit: 12 });
  const savedIds = new Set(items.map((i) => i.productId));
  const recommended = (recResp?.data ?? []).filter((p) => !savedIds.has(p._id));

  if (!hydrated) {
    return <div className="h-40" aria-hidden />;
  }

  const sorted = [...items].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 ? (
        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between gap-2">
            <h1 className="border-l-[3px] border-accent pl-3 text-sm font-black uppercase tracking-widest text-ink">
              Your Wishlist{" "}
              <span className="text-xs font-normal normal-case tracking-normal text-neutral-500">
                ({items.length})
              </span>
            </h1>
            <Button variant="ghost" size="sm" onClick={() => clear()}>
              Clear all
            </Button>
          </header>

          <ul className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {sorted.map((item) => (
              <li key={item.productId} className="flex flex-col">
                <ProductCard product={toSummary(item)} className="h-full w-full" />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyWishlist />
      )}

      {recommended.length > 0 ? (
        <ProductRow title="You might also like" products={recommended} viewAllHref="/all-products" plain />
      ) : null}
    </div>
  );
}

function EmptyWishlist() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl bg-white py-12 text-center">
      <Heart className="h-[48px] w-[48px] text-neutral-300" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-ink">No saved items yet</p>
        <p className="max-w-sm text-sm text-neutral-600">
          Tap the heart on any product to save it here. Wishlists stay on this device until we add
          account sync.
        </p>
      </div>
      <Link
        href="/all-products"
        className={buttonVariants({ variant: "primary", size: "md" })}
      >
        Browse products
      </Link>
    </section>
  );
}

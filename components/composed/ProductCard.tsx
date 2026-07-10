"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils/cn";
import type { ProductSummary } from "@/types/catalog";

export interface ProductCardProps {
  product: ProductSummary;
  className?: string;
}

function fmtPrice(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function ProductCard({ product, className }: ProductCardProps) {
  const router = useRouter();
  const hero = product.images[0];
  const href = `/product/${product.slug}`;
  // Variant products (sizes etc.) can't be added blind - checkout rejects
  // lines without a variantId, so the card routes to the PDP instead.
  const needsVariantChoice = (product.variants?.length ?? 0) > 0;
  const inWishlist = useWishlistStore((s) => s.has(product._id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const addToCart = useCartStore((s) => s.add);
  const toast = useUIStore((s) => s.toast);

  const onSale =
    typeof product.compareAtPrice === "number" && product.compareAtPrice > product.price;
  const discountPct = onSale
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const hasRating = product.ratingCount > 0;
  const brandName =
    typeof product.brand === "object" && product.brand !== null
      ? (product.brand as { name: string }).name
      : undefined;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: product._id,
      slug: product.slug,
      title: product.title,
      image: hero?.url ?? "",
      price: product.price,
    });
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    if (needsVariantChoice) {
      // Size/option products go through the PDP picker.
      toast({ title: "Choose your options", description: "Pick a size to add this item" });
      router.push(href);
      return;
    }
    addToCart({
      productId: product._id,
      slug: product.slug,
      title: product.title,
      image: hero?.url ?? "",
      price: product.price,
      originalPrice: product.compareAtPrice,
      qty: 1,
      stock: product.stock,
    });
    toast({ title: "Added to cart", description: product.title, tone: "success" });
  };

  return (
    /*
     * Outer wrapper is a div so the wishlist + ATC buttons are siblings of the
     * Link — never nested inside <a>, which is invalid HTML.
     */
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl bg-white",
        "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        "transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      {/* ── Section 1: Image + overlays ── */}
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-neutral-100">
          {hero ? (
            <Image
              src={hero.url}
              alt={hero.alt ?? product.title}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
                outOfStock && "opacity-50",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-300">
              No image
            </div>
          )}

          {/* Status badges — top-left stack */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {onSale && (
              <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide text-white">
                -{discountPct}%
              </span>
            )}
            {!onSale && product.isFeatured && (
              <span className="rounded-sm bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide text-white">
                NEW
              </span>
            )}
            {outOfStock && (
              <span className="rounded-sm bg-neutral-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                Sold Out
              </span>
            )}
            {lowStock && (
              <span className="rounded-sm bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                Few Left
              </span>
            )}
          </div>

          {/* Desktop hover ATC — slides up from image bottom, hidden on mobile */}
          <div className="absolute inset-x-0 bottom-0 hidden translate-y-full transition-transform duration-200 ease-out group-hover:translate-y-0 lg:flex">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={outOfStock}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-widest",
                outOfStock
                  ? "cursor-not-allowed bg-neutral-200 text-neutral-400"
                  : "bg-accent text-white hover:bg-accent-dark",
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
              {outOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>
        </div>

        {/* ── Section 2: Product info ── */}
        <div className="flex flex-1 flex-col px-2.5 pt-2 pb-2">
          {brandName && (
            <p className="mb-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              {brandName}
            </p>
          )}

          <h3 className="line-clamp-2 text-[12px] font-semibold leading-snug text-neutral-900 sm:text-[13px]">
            {product.title}
          </h3>

          {hasRating && (
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-[11px] w-[11px] fill-amber-400 stroke-amber-400" aria-hidden />
              <span className="text-[11px] font-semibold text-neutral-700">
                {product.ratingAverage.toFixed(1)}
              </span>
              <span className="text-[10px] text-neutral-400">
                (
                {product.ratingCount > 999
                  ? `${(product.ratingCount / 1000).toFixed(1)}k`
                  : product.ratingCount}
                )
              </span>
            </div>
          )}

          {/* Price — mt-auto keeps it at same Y across all cards in a row */}
          <div className="mt-auto pt-2">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="text-[13px] font-bold leading-none text-neutral-900">
                {fmtPrice(product.price, product.currency)}
              </span>
              {onSale && (
                <>
                  <span className="text-[10px] leading-none text-neutral-400 line-through">
                    {fmtPrice(product.compareAtPrice!, product.currency)}
                  </span>
                  <span className="text-[10px] font-bold leading-none text-emerald-600">
                    -{discountPct}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ── Wishlist — bare heart icon, no background ── */}
      <button
        type="button"
        aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
        onClick={handleWishlist}
        className="absolute right-2 top-2 z-10 p-1 transition-transform duration-150 hover:scale-110 active:scale-90"
      >
        <Heart
          className={cn(
            "h-[18px] w-[18px] transition-all duration-150",
            inWishlist
              ? "fill-accent stroke-accent drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
              : "fill-white/80 stroke-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]",
          )}
          aria-hidden
        />
      </button>

      {/* ── Mobile ATC button — full width at card bottom, hidden on desktop ── */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={outOfStock}
        aria-label={outOfStock ? "Out of stock" : `Add ${product.title} to cart`}
        className={cn(
          "flex h-9 w-full shrink-0 items-center justify-center gap-1.5",
          "text-[11px] font-bold uppercase tracking-widest",
          "transition-colors duration-150 lg:hidden",
          outOfStock
            ? "cursor-not-allowed bg-neutral-50 text-neutral-300"
            : "bg-accent text-white active:bg-accent-dark",
        )}
      >
        <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
        {outOfStock ? "Sold Out" : "Add to Cart"}
      </button>
    </div>
  );
}

/** Skeleton preserves exact card proportions during loading. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <div className="aspect-[3/4] w-full shrink-0 animate-pulse bg-neutral-100" />
      <div className="flex flex-1 flex-col gap-2 px-2.5 pt-2 pb-2">
        <div className="h-2 w-1/3 animate-pulse rounded bg-neutral-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100" />
        <div className="h-2.5 w-3/5 animate-pulse rounded bg-neutral-100" />
        <div className="mt-auto h-3.5 w-2/5 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="h-9 w-full shrink-0 animate-pulse bg-neutral-100 lg:hidden" />
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Menu, LogIn, ChevronDown, User } from "lucide-react";
import { SearchSuggestBox } from "@/components/composed";
import { CategoryMenu, type CategoryNode, type BrandLite } from "./CategoryMenu";
import { MobileMenu } from "./MobileMenu";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useUIStore } from "@/store/uiStore";
import { useAuth } from "@/hooks/useAuth";
import { COMPANY } from "@/lib/entity/company";

import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/lib/api/catalog";
import { catalogKeys } from "@/hooks/useCatalog";
import type { CategoryTreeNode } from "@/types/catalog";

export interface NavbarProps {
  categories?: CategoryNode[];
  brands?: BrandLite[];
}
asdfasda
export function Navbar({ categories: ssrCategories, brands: ssrBrands }: NavbarProps) {
  const router = useRouter();
  const cartCount = useCartStore((s) => s.count());
  const wishlistCount = useWishlistStore((s) => s.count());
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const { user, status } = useAuth();
  const wantsCategories = !ssrCategories || ssrCategories.length === 0;
  const wantsBrands = !ssrBrands || ssrBrands.length === 0;

  const catsQuery = useQuery({
    queryKey: catalogKeys.categories({ shape: "tree", isActive: true }),
    queryFn: () => catalogApi.listCategories({ shape: "tree", isActive: true }),
    enabled: wantsCategories,
    staleTime: 5 * 60_000,
  });

  const brandsQuery = useQuery({
    queryKey: catalogKeys.brands({ isActive: true, limit: 100 }),
    queryFn: () => catalogApi.listBrands({ isActive: true, limit: 100 }),
    enabled: wantsBrands,
    staleTime: 5 * 60_000,
  });

  const fallbackCategories = wantsCategories ? (catsQuery.data ?? []).map(toCategoryNode) : [];
  const fallbackBrands = wantsBrands ? (brandsQuery.data?.data ?? []).map(toBrandLite) : [];

  const categories = ssrCategories?.length ? ssrCategories : fallbackCategories;
  const brands = ssrBrands?.length ? ssrBrands : fallbackBrands;

  const submitSearch = (q: string) => {
    if (q.trim()) router.push(`/all-products?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-ink shadow-lg">

      {/* ─────────────── Mobile & tablet header (below lg) — Amazon layout ─────────────── */}
      <div className="lg:hidden">
        {/* Row 1 — menu · logo · account · wishlist · cart */}
        <div className="flex h-[52px] items-center gap-0.5 px-1.5">
          <IconButton onClick={() => setMobileMenuOpen(true)} label="Open menu">
            <Menu className="h-[22px] w-[22px]" />
          </IconButton>

          <Link
            href="/"
            className="ml-0.5 mr-auto flex shrink-0 items-center gap-1.5 p-1"
            aria-label={`${COMPANY.name} home`}
          >
            <Image src="/logo.png" alt="" aria-hidden width={28} height={28} className="rounded-full" />
            <span className="text-base font-black uppercase tracking-wide text-paper">{COMPANY.name}</span>
          </Link>

          {status !== "loading" && !user ? (
            <Link
              href="/login"
              aria-label="Sign in"
              className="flex flex-col items-end leading-tight rounded-md px-1.5 py-1 text-paper transition-colors hover:bg-white/10"
            >
              <span className="text-[10px] text-neutral-300">Hello, sign in</span>
              <span className="inline-flex items-center gap-0.5 text-[12px] font-bold">
                Account <ChevronDown className="h-3 w-3" />
              </span>
            </Link>
          ) : (
            <Link
              href="/account"
              aria-label="Account"
              className="relative inline-flex h-[40px] w-[40px] items-center justify-center rounded-full text-paper transition-colors hover:bg-white/10"
            >
              <User className="h-[21px] w-[21px]" />
            </Link>
          )}

          <IconLink href="/wishlist" label="Wishlist" count={wishlistCount}>
            <Heart className="h-[20px] w-[20px]" />
          </IconLink>
          <IconLink href="/cart" label="Cart" count={cartCount}>
            <ShoppingCart className="h-[22px] w-[22px]" />
          </IconLink>
        </div>

        {/* Row 2 — full-width search bar */}
        <div className="px-2.5 pb-2">
          <SearchSuggestBox variant="amazon" placeholder="Search products…" onSubmit={submitSearch} />
        </div>
      </div>

      {/* ─────────────── Desktop header (lg+) ─────────────── */}
      <div className="mx-auto hidden w-full px-4 lg:block lg:w-[82%] lg:px-0">
        <div className="flex h-[64px] items-center gap-6">
          <Link
            href="/"
            aria-label={`${COMPANY.name} home`}
            className="shrink-0 flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <Image src="/logo.png" alt="" aria-hidden width={38} height={38} className="rounded-full" />
            <span className="text-2xl font-black uppercase tracking-widest text-paper">{COMPANY.name}</span>
          </Link>

          <div className="min-w-0 flex-1">
            <SearchSuggestBox placeholder="Search for products, brands and more…" onSubmit={submitSearch} />
          </div>

          <nav className="flex shrink-0 items-center gap-1">
            {status !== "loading" && !user ? (
              <Link
                href="/login"
                className="mr-1 flex flex-col leading-tight rounded-md px-2 py-1 hover:bg-white/10"
              >
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-paper">
                  <LogIn className="h-[18px] w-[18px]" /> Sign in
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  Members get more
                </span>
              </Link>
            ) : null}

            <IconLink href="/wishlist" label="Wishlist" count={wishlistCount}>
              <Heart className="h-[22px] w-[22px]" />
            </IconLink>
            <IconLink href="/cart" label="Cart" count={cartCount}>
              <ShoppingCart className="h-[22px] w-[22px]" />
            </IconLink>
            <NotificationsBell />
            <UserMenu />
          </nav>
        </div>
      </div>

      {/* ─────────────── Desktop category row ─────────────── */}
      <div className="hidden lg:block bg-accent">
        <div className="mx-auto flex w-full lg:w-[82%]">
          <CategoryMenu categories={categories} brands={brands} className="w-full text-paper" />
        </div>
      </div>

      <MobileMenu categories={categories} />
    </header>
  );
}

/* ───────────────────── Reusable bits ───────────────────── */

const NavBadge = React.memo(function NavBadge({ count }: { count?: number }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || typeof count !== "number" || count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold leading-none text-paper">
      {count > 99 ? "99+" : count}
    </span>
  );
});

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex h-[40px] w-[40px] items-center justify-center rounded-full text-paper transition-colors hover:bg-white/10"
    >
      {children}
      <NavBadge count={count} />
    </Link>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-paper transition-colors hover:bg-white/10"
    >
      {children}
    </button>
  );
}

/* ───────────────────── Mappers ───────────────────── */

function toCategoryNode(node: CategoryTreeNode): CategoryNode {
  return {
    name: node.name,
    slug: node.path,
    children: node.children?.map((sub) => ({
      name: sub.name,
      slug: sub.path,
      children: sub.children?.map((leaf) => ({ name: leaf.name, slug: leaf.path })),
    })),
  };
}

function toBrandLite(b: { name: string; slug: string; logo?: string }): BrandLite {
  return { name: b.name, slug: b.slug, logo: b.logo };
}

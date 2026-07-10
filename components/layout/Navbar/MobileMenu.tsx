"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChevronDown,
  Heart,
  Home,
  LogOut,
  Package,
  Search,
  ShoppingCart,
  Tag,
  ClipboardList,
} from "lucide-react";
import { Drawer } from "@/components/complex";
import { useUIStore } from "@/store/uiStore";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useAuth } from "@/hooks/useAuth";
import type { CategoryNode } from "./CategoryMenu";
import { cn } from "@/lib/utils/cn";

export interface MobileMenuProps {
  categories: CategoryNode[];
}

export function MobileMenu({ categories }: MobileMenuProps) {
  const open = useUIStore((s) => s.mobileMenuOpen);
  const setOpen = useUIStore((s) => s.setMobileMenuOpen);
  const cartCount = useCartStore((s) => s.count());
  const wishlistCount = useWishlistStore((s) => s.count());
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = React.useState("");

  const close = () => setOpen(false);
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/all-products?q=${encodeURIComponent(q.trim())}`);
    setQ("");
    close();
  };

  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <Drawer open={open} onClose={close} side="left" title="Menu" widthClassName="w-[86vw] max-w-sm">
      <div className="flex min-h-full flex-col bg-paper">
        {/* Account header */}
        {user ? (
          <Link
            href="/account"
            onClick={close}
            className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 p-3 transition-colors hover:bg-neutral-100"
          >
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-base font-bold text-accent">
              {user.image ? (
                <Image src={user.image} alt="" width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                {user.name || "Your account"}
              </span>
              <span className="block truncate text-xs text-neutral-500">{user.email}</span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-ink p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-paper uppercase tracking-wide">Welcome</p>
              <p className="truncate text-xs text-neutral-400">Sign in for orders &amp; exclusive offers</p>
            </div>
            <Link
              href="/login"
              onClick={close}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-paper transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Search */}
        <form onSubmit={onSearch} className="border-b border-neutral-200 p-2">
          <div className="flex items-center gap-1 rounded-xl border border-neutral-300 px-2 transition-colors focus-within:border-ink">
            <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              aria-label="Search"
              className="h-9 w-full bg-transparent text-sm text-ink placeholder:text-neutral-400 focus:outline-none"
            />
          </div>
        </form>

        {/* Quick links */}
        <nav className="flex flex-col p-2">
          <SideLink href="/" label="Home" onClick={close} icon={<Home className="h-[20px] w-[20px]" />} />
          <SideLink href="/all-products" label="All Products" onClick={close} icon={<Package className="h-[20px] w-[20px]" />} />
          <SideLink href="/offers" label="Sale" onClick={close} icon={<Tag className="h-[20px] w-[20px]" />} />
          <SideLink href="/wishlist" label="Wishlist" count={wishlistCount} onClick={close} icon={<Heart className="h-[20px] w-[20px]" />} />
          <SideLink href="/cart" label="Cart" count={cartCount} onClick={close} icon={<ShoppingCart className="h-[20px] w-[20px]" />} />
          {user ? (
            <SideLink href="/account/orders" label="My Orders" onClick={close} icon={<ClipboardList className="h-[20px] w-[20px]" />} />
          ) : null}
        </nav>

        {/* Categories */}
        {categories.length > 0 ? (
          <div className="border-t border-neutral-200 p-2">
            <p className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Shop by category
            </p>
            <ul className="flex flex-col">
              {categories.map((cat) => (
                <CategoryAccordion key={cat.slug} cat={cat} onNavigate={close} />
              ))}
            </ul>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-auto border-t border-neutral-200 p-2">
          {user ? (
            <button
              type="button"
              onClick={() => {
                close();
                void signOut({ callbackUrl: "/" });
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-ink transition-colors hover:bg-neutral-100"
            >
              <LogOut className="h-[20px] w-[20px]" /> Sign out
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={close}
                className="rounded-full border border-ink py-2 text-center text-sm font-bold text-ink transition-colors hover:bg-neutral-100"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={close}
                className="rounded-full bg-accent py-2 text-center text-sm font-bold text-paper transition-opacity hover:opacity-90"
              >
                Join now
              </Link>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

/* ───────────────────── Rows ───────────────────── */

function SideLink({
  href,
  label,
  icon,
  count,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-ink transition-colors hover:bg-neutral-100"
    >
      <span className="text-neutral-600">{icon}</span>
      <span className="flex-1">{label}</span>
      {typeof count === "number" && count > 0 ? (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-accent">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function CategoryAccordion({ cat, onNavigate }: { cat: CategoryNode; onNavigate: () => void }) {
  const [open, setOpen] = React.useState(false);
  const hasChildren = Boolean(cat.children?.length);

  return (
    <li className="border-b border-neutral-100 last:border-b-0">
      <div className="flex items-center">
        <Link
          href={`/category/${cat.slug}`}
          onClick={onNavigate}
          className="flex-1 rounded-md px-2 py-2 text-sm font-medium text-ink hover:bg-neutral-100"
        >
          {cat.name}
        </Link>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Toggle ${cat.name}`}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
          >
            <ChevronDown
              className={cn("h-[18px] w-[18px] transition-transform duration-hover", open && "rotate-180")}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <ul className="ml-3 flex flex-col border-l border-neutral-200 pl-2 pb-1">
          {cat.children!.map((sub) => (
            <li key={sub.slug}>
              <Link
                href={`/category/${sub.slug}`}
                onClick={onNavigate}
                className="block rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                {sub.name}
              </Link>
              {sub.children?.length ? (
                <ul className="ml-3 flex flex-col border-l border-neutral-100 pl-2">
                  {sub.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/category/${child.slug}`}
                        onClick={onNavigate}
                        className="block rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowLeft,
  ChevronRight,
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

export interface MobileMenuProps {
  categories: CategoryNode[];
}

/**
 * A node in the drill-down stack. CategoryNode / SubCategory / ChildCategory
 * all share this shape, so one type covers every level of the tree.
 */
interface DrillNode {
  name: string;
  slug: string;
  children?: DrillNode[];
}

export function MobileMenu({ categories }: MobileMenuProps) {
  const open = useUIStore((s) => s.mobileMenuOpen);
  const setOpen = useUIStore((s) => s.setMobileMenuOpen);
  const cartCount = useCartStore((s) => s.count());
  const wishlistCount = useWishlistStore((s) => s.count());
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = React.useState("");

  /* Drill-down navigation stack. Empty = root menu; each push shows that
   * category's children as a fresh panel (parent → sub → child), Klassy
   * Missy style. Reset whenever the drawer closes. */
  const [stack, setStack] = React.useState<DrillNode[]>([]);
  React.useEffect(() => {
    if (!open) setStack([]);
  }, [open]);

  const current = stack.length > 0 ? stack[stack.length - 1] : null;
  const push = (node: DrillNode) => setStack((s) => [...s, node]);
  const pop = () => setStack((s) => s.slice(0, -1));

  const close = () => setOpen(false);
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/all-products?q=${encodeURIComponent(q.trim())}`);
    setQ("");
    close();
  };

  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  /* Drilled-in view: back arrow + level name in the drawer header, then a
   * "Go To X" row and the level's children. */
  if (current) {
    return (
      <Drawer
        open={open}
        onClose={close}
        side="left"
        widthClassName="w-[86vw] max-w-sm"
        title={
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={pop}
              aria-label="Back"
              className="-ml-1 inline-flex h-[32px] w-[32px] items-center justify-center rounded-md text-ink transition-colors hover:bg-neutral-100"
            >
              <ArrowLeft className="h-[20px] w-[20px]" aria-hidden />
            </button>
            <span className="text-sm font-semibold uppercase tracking-widest text-ink">
              {current.name}
            </span>
          </span>
        }
      >
        <div className="flex min-h-full flex-col bg-paper">
          <ul className="flex flex-col">
            {/* Link to the level's own category page */}
            <li>
              <Link
                href={`/category/${current.slug}`}
                onClick={close}
                className="block border-b border-neutral-100 px-4 py-[14px] text-[13px] font-medium tracking-wide text-ink transition-colors hover:bg-neutral-50"
              >
                Go To {current.name}
              </Link>
            </li>
            {(current.children ?? []).map((item) => (
              <DrillRow key={item.slug} item={item} onDrill={push} onNavigate={close} />
            ))}
          </ul>
        </div>
      </Drawer>
    );
  }

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

        {/* Categories - directly under the search bar; tapping a parent with
            children drills into a fresh panel instead of expanding an
            accordion. */}
        {categories.length > 0 ? (
          <div>
            <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Shop by category
            </p>
            <ul className="flex flex-col">
              {categories.map((cat) =>
                cat.children?.length ? (
                  <li key={cat.slug}>
                    <button
                      type="button"
                      onClick={() => setStack([cat])}
                      className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-[14px] text-left text-[13px] font-medium uppercase tracking-wide text-ink transition-colors hover:bg-neutral-50"
                    >
                      {cat.name}
                      <ChevronRight className="h-[16px] w-[16px] shrink-0 text-neutral-400" aria-hidden />
                    </button>
                  </li>
                ) : (
                  <li key={cat.slug}>
                    <Link
                      href={`/category/${cat.slug}`}
                      onClick={close}
                      className="block border-b border-neutral-100 px-4 py-[14px] text-[13px] font-medium uppercase tracking-wide text-ink transition-colors hover:bg-neutral-50"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}

        {/* Quick links - after the category list */}
        <nav className="flex flex-col border-t border-neutral-200 p-2">
          <SideLink href="/" label="Home" onClick={close} icon={<Home className="h-[20px] w-[20px]" />} />
          <SideLink href="/all-products" label="All Products" onClick={close} icon={<Package className="h-[20px] w-[20px]" />} />
          <SideLink href="/offers" label="Sale" onClick={close} icon={<Tag className="h-[20px] w-[20px]" />} />
          <SideLink href="/wishlist" label="Wishlist" count={wishlistCount} onClick={close} icon={<Heart className="h-[20px] w-[20px]" />} />
          <SideLink href="/cart" label="Cart" count={cartCount} onClick={close} icon={<ShoppingCart className="h-[20px] w-[20px]" />} />
          {user ? (
            <SideLink href="/account/orders" label="My Orders" onClick={close} icon={<ClipboardList className="h-[20px] w-[20px]" />} />
          ) : null}
        </nav>

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

/**
 * One row inside a drilled-in panel. Items with children drill deeper
 * (chevron on the right); leaf items navigate straight to their category.
 */
function DrillRow({
  item,
  onDrill,
  onNavigate,
}: {
  item: DrillNode;
  onDrill: (node: DrillNode) => void;
  onNavigate: () => void;
}) {
  if (item.children?.length) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onDrill(item)}
          className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-[14px] text-left text-[13px] font-medium tracking-wide text-ink transition-colors hover:bg-neutral-50"
        >
          {item.name}
          <ChevronRight className="h-[16px] w-[16px] shrink-0 text-neutral-400" aria-hidden />
        </button>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={`/category/${item.slug}`}
        onClick={onNavigate}
        className="block border-b border-neutral-100 px-4 py-[14px] text-[13px] font-medium tracking-wide text-ink transition-colors hover:bg-neutral-50"
      >
        {item.name}
      </Link>
    </li>
  );
}

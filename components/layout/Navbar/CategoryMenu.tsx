"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ───────────────────── Types ─────────────────────
 * The desktop strip mirrors the 3-tier mobile accordion so we don't fork data.
 * CategoryNode is intentionally a thin view of the heavier CategoryTreeNode the
 * homepage already passes - see app/page.tsx for the mapper.
 */
export interface ChildCategory {
  name: string;
  slug: string;
}
export interface SubCategory {
  name: string;
  slug: string;
  children?: ChildCategory[];
}
export interface CategoryNode {
  name: string;
  slug: string;
  children?: SubCategory[];
}

/**
 * Brand summary used by the desktop "Brands" dropdown. Kept as a structural
 * type so the consumer can pass either BrandSummary or BrandDetail from
 * @/types/catalog without an explicit cast.
 */
export interface BrandLite {
  name: string;
  slug: string;
  logo?: string;
}

export interface CategoryMenuProps {
  categories: CategoryNode[];
  brands?: BrandLite[];
  className?: string;
}

/**
 * Desktop category strip - black bar with white uppercase items, modeled after
 * the Klassy Missy reference. Layout:
 *
 *   [☰]  HOME   FACE   LIPS   EYES   BRANDS   …
 *           ▲ hover any item to reveal a small dropdown anchored beneath it
 *
 * - The strip lives inside the Navbar's row 2, which renders a full-width
 *   black band. This component supplies its own white-on-black styling.
 * - Hovering - or focusing via keyboard - an item with children opens a
 *   compact per-item dropdown listing its sub-categories (and optional
 *   grand-children as an indented sub-list). The dropdown is anchored to the
 *   item itself, not to the whole bar, so multiple opens never overlap and
 *   the cursor only has to travel a short distance from trigger to menu.
 * - The active item is rendered as a white "pill" with black text - matches
 *   the highlighted HOME state in the reference screenshot.
 * - The leading hamburger button opens the mobile/side drawer (`MobileMenu`)
 *   even on desktop, giving keyboard users a non-hover path to the full tree.
 *
 * Mobile uses MobileMenu/CategoryAccordion instead; this component is hidden
 * below md.
 */
export function CategoryMenu({ categories, brands = [], className }: CategoryMenuProps) {
  const [active, setActive] = React.useState<string | null>(null);
  const pathname = usePathname();

  const items = React.useMemo(
    () => [
      {
        id: "__brands__",
        label: "Brands",
        href: "/brands" as const,
        hasMenu: brands.length > 0,
      },
      ...categories.map((c) => ({
        id: c.slug,
        label: c.name,
        href: `/category/${c.slug}` as const,
        hasMenu: Boolean(c.children?.length),
      })),
    ],
    [brands.length, categories],
  );

  return (
    <nav
      className={cn("relative hidden md:block", className)}
      aria-label="Browse"
      onMouseLeave={() => setActive(null)}
    >
      <div className="flex items-stretch">
        <ul className="flex items-stretch">
          {items.map((item) => {
            const isActive = active === item.id;
            const isCurrent =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li
                key={item.id}
                className="relative"
                onMouseEnter={() => setActive(item.hasMenu ? item.id : null)}
              >
                <Link
                  href={item.href}
                  onFocus={() => setActive(item.hasMenu ? item.id : null)}
                  className={cn(
                    "inline-flex h-full items-center gap-1 border-b-2 px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider transition-colors duration-150",
                    isActive || isCurrent
                      ? "border-white text-white"
                      : "border-transparent text-white/80 hover:border-white/50 hover:text-white",
                  )}
                  aria-expanded={isActive}
                  aria-haspopup={item.hasMenu ? "menu" : undefined}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  {item.label}
                  {item.hasMenu ? (
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-150",
                        isActive ? "rotate-180 text-white/80" : "text-white/60",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </Link>

                {/* Per-item dropdown - only the active item renders one. */}
                {isActive && item.hasMenu ? (
                  <ItemDropdown
                    itemId={item.id}
                    categories={categories}
                    brands={brands}
                    onClose={() => setActive(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/* ───────────────────── Per-item dropdown ─────────────────────
 *
 * Each dropdown is anchored to its trigger (`absolute top-full left-0`) and
 * sits flush against the black bar so the cursor can travel from trigger to
 * panel without crossing a dead zone. Dropdowns are intentionally light-
 * themed (white background, dark text) to pop against the dark bar above -
 * matches the typical mass-market beauty site pattern (klassymissy, sephora,
 * ulta).
 */
interface ItemDropdownProps {
  itemId: string;
  categories: CategoryNode[];
  brands: BrandLite[];
  onClose: () => void;
}

function ItemDropdown({ itemId, categories, brands, onClose }: ItemDropdownProps) {
  const isBrands = itemId === "__brands__";
  const cat = !isBrands ? categories.find((c) => c.slug === itemId) : undefined;

  if (isBrands) {
    return <BrandsDropdown brands={brands} onNavigate={onClose} />;
  }
  if (cat) {
    return <CategoryDropdown category={cat} onNavigate={onClose} />;
  }
  return null;
}

/* ─── Category dropdown ────────────────────────────────────────────────── */

function CategoryDropdown({
  category,
  onNavigate,
}: {
  category: CategoryNode;
  onNavigate: () => void;
}) {
  const subs = category.children ?? [];

  if (!subs.length) {
    return null;
  }

  return (
    <div
      role="menu"
      className="animate-dropdown-in absolute left-0 top-full z-40 flex min-w-[12rem] flex-col rounded-b-xl border border-t-0 border-neutral-200 bg-paper shadow-xl"
    >
      <div className="flex flex-row items-start gap-1 p-4">
        {subs.map((sub) => (
          <div key={sub.slug} className="flex min-w-[12rem] flex-col">
            <Link
              href={`/category/${sub.slug}`}
              onClick={onNavigate}
              className="mb-2 block rounded-lg px-2 py-1.5 text-[12px] font-bold uppercase tracking-wide text-ink transition-colors hover:bg-neutral-100"
            >
              {sub.name}
            </Link>

            {sub.children?.length ? (
              <ul className="flex flex-col gap-1">
                {sub.children.map((child) => (
                  <li key={child.slug}>
                    <Link
                      href={`/category/${child.slug}`}
                      onClick={onNavigate}
                      className="block rounded-lg px-2 py-1 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-ink"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {/* Footer "Shop All" section */}
      <div className="border-t border-neutral-100 bg-neutral-50/50 px-6 py-3">
        <Link
          href={`/category/${category.slug}`}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-ink hover:underline"
        >
          Shop all {category.name.toLowerCase()}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/* ─── Brands dropdown ──────────────────────────────────────────────────── */

function BrandsDropdown({
  brands,
  onNavigate,
}: {
  brands: BrandLite[];
  onNavigate: () => void;
}) {
  if (!brands.length) {
    return null;
  }
  // Cap at 12 so the dropdown stays a manageable size - the "See all brands"
  // CTA below routes to the dedicated /brands page with the full A–Z grid.
  const visible = brands.slice(0, 12);
  return (
    <div
      role="menu"
      className="animate-dropdown-in absolute left-0 top-full z-40 w-[min(56rem,90vw)] rounded-b-xl border border-t-0 border-neutral-200 bg-paper p-3 shadow-xl"
    >
      <div className="grid grid-cols-6 gap-1.5">
        {visible.map((b) => (
          <Link
            key={b.slug}
            href={`/all-products?brand=${encodeURIComponent(b.slug)}`}
            onClick={onNavigate}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-200 p-2 transition-colors duration-150 hover:border-neutral-400 hover:bg-neutral-50"
          >
            {b.logo ? (
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50">
                <Image
                  src={b.logo}
                  alt={b.name}
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                  unoptimized
                />
              </span>
            ) : (
              <span
                aria-hidden
                className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-base font-semibold text-neutral-500"
              >
                {b.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="w-full truncate text-center text-xs font-medium text-ink">
              {b.name}
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-2 border-t border-neutral-200 pt-2">
        <Link
          href="/brands"
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-neutral-600 hover:text-ink hover:underline"
        >
          See all brands
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

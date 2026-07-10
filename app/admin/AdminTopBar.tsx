"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bell,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { usePalette, useIsMac } from "./AdminCommandPalette";

/* ─────────────── Page metadata ─────────────── */

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/analytics": "Analytics",
  "/admin/analytics/conversion": "Conversion",
  "/admin/analytics/attribution": "Attribution",
  "/admin/analytics/financial": "Financial",
  "/admin/analytics/marketing": "Marketing",
  "/admin/orders": "Orders",
  "/admin/pos": "Point of Sale",
  "/admin/products": "Products",
  "/admin/categories": "Categories",
  "/admin/brands": "Brands",
  "/admin/coupons": "Coupons",
  "/admin/offers": "Offers",
  "/admin/reviews": "Reviews",
  "/admin/questions": "Q&A",
  "/admin/users": "Users",
  "/admin/audit": "Audit Log",
  "/admin/company-profile": "Company Profile",
  "/admin/barcodes": "Barcodes",
  "/admin/integrations": "Integrations",
};

/* ─────────────── Breadcrumb ─────────────── */

interface BreadcrumbSegment {
  label: string;
  href: string;
}

function getBreadcrumb(pathname: string | null): BreadcrumbSegment[] {
  if (!pathname || pathname === "/admin") return [];

  if (pathname.startsWith("/admin/products/new")) {
    return [
      { label: "Products", href: "/admin/products" },
      { label: "New Product", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/products/") && pathname !== "/admin/products") {
    return [
      { label: "Products", href: "/admin/products" },
      { label: "Edit Product", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/orders/")) {
    return [
      { label: "Orders", href: "/admin/orders" },
      { label: "Order Detail", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/categories/new")) {
    return [
      { label: "Categories", href: "/admin/categories" },
      { label: "New Category", href: "" },
    ];
  }
  if (
    pathname.startsWith("/admin/categories/") &&
    pathname !== "/admin/categories"
  ) {
    return [
      { label: "Categories", href: "/admin/categories" },
      { label: "Edit Category", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/brands/new")) {
    return [
      { label: "Brands", href: "/admin/brands" },
      { label: "New Brand", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/brands/") && pathname !== "/admin/brands") {
    return [
      { label: "Brands", href: "/admin/brands" },
      { label: "Edit Brand", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/coupons/new")) {
    return [
      { label: "Coupons", href: "/admin/coupons" },
      { label: "New Coupon", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/coupons/") && pathname !== "/admin/coupons") {
    return [
      { label: "Coupons", href: "/admin/coupons" },
      { label: "Edit Coupon", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/offers/new")) {
    return [
      { label: "Offers", href: "/admin/offers" },
      { label: "New Offer", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/offers/") && pathname !== "/admin/offers") {
    return [
      { label: "Offers", href: "/admin/offers" },
      { label: "Edit Offer", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/users/")) {
    return [
      { label: "Users", href: "/admin/users" },
      { label: "User Detail", href: "" },
    ];
  }
  if (pathname.startsWith("/admin/analytics/")) {
    return [
      { label: "Analytics", href: "/admin/analytics" },
      { label: PAGE_TITLES[pathname] ?? "Report", href: "" },
    ];
  }

  return [];
}

/* ─────────────── TopBar ─────────────── */

export interface AdminTopBarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
}

export function AdminTopBar({
  collapsed,
  onToggleCollapse,
  onToggleMobile,
}: AdminTopBarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open } = usePalette();
  const isMac = useIsMac();

  const breadcrumb = getBreadcrumb(pathname);
  const pageTitle = PAGE_TITLES[pathname ?? ""] ?? "Admin";
  const initial = (session?.user?.name ?? session?.user?.email ?? "A")
    .charAt(0)
    .toUpperCase();

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-neutral-100 bg-paper px-3 md:px-4">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onToggleMobile}
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {/* Desktop collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden h-8 w-8 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 md:inline-flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[17px] w-[17px]" aria-hidden />
        ) : (
          <PanelLeftClose className="h-[17px] w-[17px]" aria-hidden />
        )}
      </button>

      <div className="hidden h-4 w-px bg-neutral-200 md:block" />

      {/* Breadcrumb or page title */}
      {breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1">
          {breadcrumb.map((seg, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <ChevronRight
                    className="h-3 w-3 shrink-0 text-neutral-300"
                    aria-hidden
                  />
                )}
                {isLast || !seg.href ? (
                  <span className="text-[13.5px] font-semibold text-neutral-900">
                    {seg.label}
                  </span>
                ) : (
                  <Link
                    href={seg.href}
                    className="text-[13.5px] text-neutral-400 transition-colors hover:text-neutral-700"
                  >
                    {seg.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      ) : (
        <h1 className="text-[13.5px] font-semibold text-neutral-900">
          {pageTitle}
        </h1>
      )}

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Search */}
        <button
          type="button"
          onClick={open}
          className={cn(
            "hidden sm:inline-flex items-center gap-2 rounded-sm border border-neutral-200 bg-neutral-50",
            "h-[30px] px-2.5 text-[12px] text-neutral-400 transition-all duration-150",
            "hover:border-neutral-300 hover:bg-paper hover:text-neutral-600",
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Search</span>
          <kbd className="ml-1 rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 ring-1 ring-neutral-200/80">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>

        {/* Storefront link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          title="Open storefront"
        >
          <Store className="h-[17px] w-[17px]" aria-hidden />
        </Link>

        {/* Notification bell */}
        <button
          type="button"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px]" aria-hidden />
        </button>

        {/* User avatar */}
        {session?.user && (
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[12px] font-bold text-accent"
            title={session.user.name ?? session.user.email ?? "Admin"}
          >
            {initial}
          </div>
        )}
      </div>
    </header>
  );
}

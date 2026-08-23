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
  "/admin/chat-logs": "Chat Logs",
  "/admin/users": "Users",
  "/admin/audit": "Audit Log",
  "/admin/settings": "Settings",
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
    <header className="flex h-[64px] shrink-0 items-center gap-[8px] border-b border-gray-200 bg-white px-[16px]">
      {/* Mobile hamburger - Flowbite navbar toggle */}
      <button
        type="button"
        onClick={onToggleMobile}
        className="inline-flex items-center justify-center rounded-[8px] p-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-[24px] w-[24px]" aria-hidden />
      </button>

      {/* Desktop collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden items-center justify-center rounded-[8px] p-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900 md:inline-flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[24px] w-[24px]" aria-hidden />
        ) : (
          <PanelLeftClose className="h-[24px] w-[24px]" aria-hidden />
        )}
      </button>

      {/* Breadcrumb or page title - Flowbite breadcrumb recipe */}
      {breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-[4px]">
          {breadcrumb.map((seg, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <ChevronRight
                    className="h-[16px] w-[16px] shrink-0 text-gray-400"
                    aria-hidden
                  />
                )}
                {isLast || !seg.href ? (
                  <span className="truncate text-[14px] font-medium text-gray-500">
                    {seg.label}
                  </span>
                ) : (
                  <Link
                    href={seg.href}
                    className="text-[14px] font-medium text-gray-700 transition duration-75 hover:text-gray-900"
                  >
                    {seg.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      ) : (
        <h1 className="truncate text-[16px] font-semibold text-gray-900">
          {pageTitle}
        </h1>
      )}

      {/* Search - Flowbite navbar search input (left-aligned, lg:w-96),
          rendered as a button that opens the command palette. */}
      <button
        type="button"
        onClick={open}
        className={cn(
          "relative ml-[16px] hidden h-[36px] items-center rounded-[8px] border border-gray-300 bg-gray-50 md:flex",
          "w-[200px] pl-[34px] pr-[8px] text-[13px] text-gray-500 transition duration-75",
          "hover:bg-gray-100 lg:w-[256px]",
        )}
      >
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[10px]">
          <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
        </span>
        <span className="flex-1 truncate text-left">Search</span>
        <kbd className="ml-[8px] rounded-[4px] border border-gray-200 bg-white px-[6px] py-[2px] text-[11px] font-medium text-gray-500">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Right actions - Flowbite icon buttons + avatar */}
      <div className="ml-auto flex items-center gap-[4px]">
        {/* Storefront link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-[8px] p-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
          title="Open storefront"
        >
          <Store className="h-[24px] w-[24px]" aria-hidden />
        </Link>

        {/* Notification bell */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-[8px] p-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Notifications"
        >
          <Bell className="h-[24px] w-[24px]" aria-hidden />
        </button>

        {/* User avatar */}
        {session?.user && (
          <div
            className="ml-[8px] flex h-[32px] w-[32px] items-center justify-center rounded-full bg-gray-900 text-[13px] font-semibold text-white"
            title={session.user.name ?? session.user.email ?? "Admin"}
          >
            {initial}
          </div>
        )}
      </div>
    </header>
  );
}

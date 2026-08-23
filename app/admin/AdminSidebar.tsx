"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BadgePercent,
  Barcode,
  Bot,
  Building2,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Filter,
  FolderTree,
  HelpCircle,
  History,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageSquare,
  Package,
  Palette,
  Plug,
  Route,
  ScanLine,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { COMPANY } from "@/lib/entity/company";
import { usePalette, useIsMac, PaletteShortcutHint } from "./AdminCommandPalette";

/* ─────────────── Nav structure ───────────────
 * Flowbite's application-UI sidebar has no section headings - groups are
 * separated by a top border instead - so section labels here only feed the
 * collapsed-rail tooltips / aria, not visible headings.
 */

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
  children?: Array<{ href: string; label: string; Icon: LucideIcon }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
      {
        href: "/admin/analytics",
        label: "Analytics",
        Icon: LineChart,
        exact: true,
        children: [
          { href: "/admin/analytics/conversion", label: "Conversion", Icon: Filter },
          { href: "/admin/analytics/attribution", label: "Attribution", Icon: Route },
          { href: "/admin/analytics/financial", label: "Financial", Icon: DollarSign },
          { href: "/admin/analytics/marketing", label: "Marketing", Icon: Megaphone },
        ],
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", Icon: ShoppingBag },
      { href: "/admin/pos", label: "Point of Sale", Icon: ScanLine },
      { href: "/admin/barcodes", label: "Barcodes", Icon: Barcode },
      { href: "/admin/coupons", label: "Coupons", Icon: BadgePercent },
      { href: "/admin/offers", label: "Offers", Icon: Sparkles },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", Icon: Package },
      { href: "/admin/categories", label: "Categories", Icon: FolderTree },
      { href: "/admin/brands", label: "Brands", Icon: Tag },
      { href: "/admin/customizations", label: "Customizations", Icon: Palette },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/reviews", label: "Reviews", Icon: MessageSquare },
      { href: "/admin/questions", label: "Q&A", Icon: HelpCircle },
      { href: "/admin/chat-logs", label: "Chat Logs", Icon: Bot },
      { href: "/admin/users", label: "Users", Icon: Users },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/audit", label: "Audit Log", Icon: History },
      { href: "/admin/settings", label: "Settings", Icon: Building2 },
      { href: "/admin/integrations", label: "Integrations", Icon: Plug },
    ],
  },
];

/* ─────────────── Nav link ───────────────
 * Flowbite item recipe: p-2 rounded-lg text-base font-medium text-gray-900,
 * hover:bg-gray-100, current page bg-gray-100; icons w-6 h-6 text-gray-400
 * that darken to gray-900 on hover/active. Children drop the icon and indent
 * with pl-11. All spacing is explicit px because of this repo's 8px scale.
 */

function NavLink({
  href,
  label,
  Icon,
  active,
  collapsed,
  depth = 0,
  onClick,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  depth?: number;
  onClick?: () => void;
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        title={label}
        className={cn(
          "group flex h-[40px] w-[40px] items-center justify-center rounded-[8px] transition duration-75",
          active ? "bg-gray-100" : "hover:bg-gray-100",
        )}
      >
        <Icon
          className={cn(
            "h-[24px] w-[24px] shrink-0 transition duration-75",
            active ? "text-gray-900" : "text-gray-400 group-hover:text-gray-900",
          )}
          aria-hidden
        />
      </Link>
    );
  }

  if (depth > 0) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex w-full items-center rounded-[8px] p-[8px] pl-[44px] text-[16px] font-medium text-gray-900 transition duration-75",
          active ? "bg-gray-100" : "hover:bg-gray-100",
        )}
      >
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center rounded-[8px] p-[8px] text-[16px] font-medium text-gray-900 transition duration-75",
        active ? "bg-gray-100" : "hover:bg-gray-100",
      )}
    >
      <Icon
        className={cn(
          "h-[24px] w-[24px] shrink-0 transition duration-75",
          active ? "text-gray-900" : "text-gray-400 group-hover:text-gray-900",
        )}
        aria-hidden
      />
      <span className="ml-[12px] truncate">{label}</span>
    </Link>
  );
}

/* ─────────────── Analytics expandable group ───────────────
 * Flowbite collapse dropdown: trigger looks like a nav item with a trailing
 * chevron; the open list is py-2 space-y-2 with icon-less pl-11 children.
 */

function AnalyticsGroup({
  item,
  pathname,
  collapsed,
  onLinkClick,
}: {
  item: NavItem;
  pathname: string | null;
  collapsed: boolean;
  onLinkClick?: () => void;
}) {
  const childActive = item.children?.some(
    (c) => pathname === c.href || pathname?.startsWith(`${c.href}/`),
  );
  const selfActive = pathname === item.href;
  const anyActive = selfActive || childActive;
  const [open, setOpen] = React.useState(anyActive ?? false);

  React.useEffect(() => {
    if (anyActive) setOpen(true);
  }, [anyActive]);

  if (collapsed) {
    return (
      <NavLink
        href={item.href}
        label={item.label}
        Icon={item.Icon}
        active={anyActive ?? false}
        collapsed
        onClick={onLinkClick}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="group flex w-full items-center rounded-[8px] p-[8px] text-[16px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
      >
        <item.Icon
          className={cn(
            "h-[24px] w-[24px] shrink-0 transition duration-75",
            anyActive ? "text-gray-900" : "text-gray-400 group-hover:text-gray-900",
          )}
          aria-hidden
        />
        <span className="ml-[12px] flex-1 truncate whitespace-nowrap text-left">
          {item.label}
        </span>
        <ChevronDown
          className={cn(
            "h-[24px] w-[24px] shrink-0 text-gray-400 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && item.children && (
        <ul className="space-y-[8px] py-[8px]">
          <li>
            <NavLink
              href={item.href}
              label="Overview"
              Icon={item.Icon}
              active={selfActive ?? false}
              collapsed={false}
              depth={1}
              onClick={onLinkClick}
            />
          </li>
          {item.children.map((child) => {
            const active =
              pathname === child.href ||
              (pathname?.startsWith(`${child.href}/`) ?? false);
            return (
              <li key={child.href}>
                <NavLink
                  href={child.href}
                  label={child.label}
                  Icon={child.Icon}
                  active={active}
                  collapsed={false}
                  depth={1}
                  onClick={onLinkClick}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─────────────── Shared sidebar content ─────────────── */

function SidebarContent({
  collapsed,
  onLinkClick,
}: {
  collapsed: boolean;
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open: openPalette } = usePalette();
  const isMac = useIsMac();

  const initial = (session?.user?.name ?? session?.user?.email ?? "A")
    .charAt(0)
    .toUpperCase();
  const userName = session?.user?.name ?? session?.user?.email ?? "Admin";
  const userRole =
    (session?.user as { role?: string } | undefined)?.role ?? "admin";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* ── Brand ── */}
      <div
        className={cn(
          "flex h-[64px] shrink-0 items-center border-b border-gray-200",
          collapsed ? "justify-center px-[12px]" : "px-[16px]",
        )}
      >
        <Image
          src="/logo.png"
          alt={COMPANY.name}
          width={32}
          height={32}
          className="shrink-0 rounded-[4px]"
          priority
        />
        {!collapsed && (
          <span className="ml-[12px] truncate text-[20px] font-semibold text-gray-900">
            {COMPANY.name}
          </span>
        )}
      </div>

      {/* ── Scrollable nav ── */}
      <div
        className={cn(
          "flex-1 overflow-y-auto py-[20px]",
          collapsed ? "px-[12px]" : "px-[12px]",
        )}
        style={{ scrollbarWidth: "none" }}
      >
        {/* Search - styled like Flowbite's sidebar search input, but it's a
            button that opens the command palette. */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => {
              openPalette();
              onLinkClick?.();
            }}
            title="Search"
            className="group mb-[16px] flex h-[40px] w-[40px] items-center justify-center rounded-[8px] transition duration-75 hover:bg-gray-100"
          >
            <Search
              className="h-[24px] w-[24px] text-gray-400 transition duration-75 group-hover:text-gray-900"
              aria-hidden
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              openPalette();
              onLinkClick?.();
            }}
            className="relative mb-[16px] flex w-full items-center rounded-[8px] border border-gray-300 bg-gray-50 p-[8px] pl-[40px] text-[14px] text-gray-500 transition duration-75 hover:bg-gray-100"
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[20px] w-[20px] text-gray-500" aria-hidden />
            </span>
            <span className="flex-1 truncate text-left">Search</span>
            <PaletteShortcutHint isMac={isMac} />
          </button>
        )}

        <nav aria-label="Admin navigation">
          {NAV.map((section, si) => (
            <ul
              key={section.label}
              aria-label={section.label}
              className={cn(
                "space-y-[8px]",
                si > 0 && "mt-[20px] border-t border-gray-200 pt-[20px]",
                collapsed && "flex flex-col items-center",
              )}
            >
              {section.items.map((item) => {
                if (item.children) {
                  return (
                    <li key={item.href} className={cn(!collapsed && "w-full")}>
                      <AnalyticsGroup
                        item={item}
                        pathname={pathname}
                        collapsed={collapsed}
                        onLinkClick={onLinkClick}
                      />
                    </li>
                  );
                }
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    (pathname?.startsWith(`${item.href}/`) ?? false);
                return (
                  <li key={item.href} className={cn(!collapsed && "w-full")}>
                    <NavLink
                      href={item.href}
                      label={item.label}
                      Icon={item.Icon}
                      active={active}
                      collapsed={collapsed}
                      onClick={onLinkClick}
                    />
                  </li>
                );
              })}
            </ul>
          ))}
        </nav>
      </div>

      {/* ── Bottom icon bar - Flowbite's centered icon row ── */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-white p-[16px]",
          collapsed ? "flex-col gap-[8px]" : "space-x-[16px]",
        )}
      >
        <span
          title={`${userName} (${userRole})`}
          className="flex h-[32px] w-[32px] shrink-0 cursor-default items-center justify-center rounded-full bg-gray-900 text-[13px] font-semibold text-white"
        >
          {initial}
        </span>
        <Link
          href="/admin/settings"
          onClick={onLinkClick}
          title="Settings"
          className="inline-flex items-center justify-center rounded-[4px] p-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
        >
          <Settings className="h-[24px] w-[24px]" aria-hidden />
        </Link>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title="Open storefront"
          className="inline-flex items-center justify-center rounded-[4px] p-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
        >
          <ExternalLink className="h-[24px] w-[24px]" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/* ─────────────── Sidebar shell ─────────────── */

export interface AdminSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
}: AdminSidebarProps) {
  return (
    <>
      {/* Desktop - always in flow, width transitions */}
      <aside
        className={cn(
          "hidden h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-[64px]" : "w-[256px]",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <div
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-gray-900/50 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onMobileClose}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[256px] flex-col border-r border-gray-200 bg-white shadow-2xl",
            "transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="absolute right-[10px] top-[18px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-[4px] text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-[16px] w-[16px]" aria-hidden />
          </button>
          <SidebarContent collapsed={false} onLinkClick={onMobileClose} />
        </aside>
      </div>
    </>
  );
}

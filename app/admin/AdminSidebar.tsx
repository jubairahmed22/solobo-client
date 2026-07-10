"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BadgePercent,
  Barcode,
  Building2,
  ChevronDown,
  ChevronRight,
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

/* ─────────────── Nav structure ─────────────── */

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
      { href: "/admin/users", label: "Users", Icon: Users },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/audit", label: "Audit Log", Icon: History },
      { href: "/admin/company-profile", label: "Company Profile", Icon: Building2 },
      { href: "/admin/integrations", label: "Integrations", Icon: Plug },
    ],
  },
];

/* ─────────────── Nav link ─────────────── */

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
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-sm text-[13px] leading-none transition-all duration-150",
        collapsed
          ? "h-9 w-9 justify-center"
          : depth > 0
            ? "py-[7px] pl-[28px] pr-2.5"
            : "px-2.5 py-[7px]",
        active
          ? "bg-ink font-semibold text-paper"
          : "font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-[17px] w-[17px]" : "h-[15px] w-[15px]",
          active
            ? "text-accent"
            : "opacity-60 group-hover:opacity-100",
        )}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

/* ─────────────── Analytics expandable group ─────────────── */

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
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-[13px] leading-none transition-all duration-150",
          anyActive
            ? "bg-ink font-semibold text-paper"
            : "font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
        )}
      >
        <item.Icon
          className={cn(
            "h-[15px] w-[15px] shrink-0 transition-colors",
            anyActive ? "text-accent" : "opacity-60 group-hover:opacity-100",
          )}
          aria-hidden
        />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {open ? (
          <ChevronDown className="h-[11px] w-[11px] shrink-0 opacity-40" aria-hidden />
        ) : (
          <ChevronRight className="h-[11px] w-[11px] shrink-0 opacity-40" aria-hidden />
        )}
      </button>

      {open && item.children && (
        <div className="ml-[21px] mt-0.5 border-l border-neutral-200 pl-[9px]">
          <NavLink
            href={item.href}
            label="Overview"
            Icon={item.Icon}
            active={selfActive ?? false}
            collapsed={false}
            depth={1}
            onClick={onLinkClick}
          />
          {item.children.map((child) => {
            const active =
              pathname === child.href ||
              (pathname?.startsWith(`${child.href}/`) ?? false);
            return (
              <NavLink
                key={child.href}
                href={child.href}
                label={child.label}
                Icon={child.Icon}
                active={active}
                collapsed={false}
                depth={1}
                onClick={onLinkClick}
              />
            );
          })}
        </div>
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Brand ── */}
      <div
        className={cn(
          "flex h-[52px] shrink-0 items-center gap-2.5 border-b border-neutral-100",
          collapsed ? "justify-center px-[10px]" : "px-[14px]",
        )}
      >
        <Image
          src="/logo.png"
          alt={COMPANY.name}
          width={26}
          height={26}
          className="shrink-0 rounded-sm"
          priority
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold tracking-tight text-ink">
              {COMPANY.name}
            </p>
            <p className="truncate text-[10.5px] leading-tight text-neutral-400">
              Admin Console
            </p>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className={cn("px-[10px] pb-1.5 pt-2.5", collapsed && "px-[8px]")}>
        <button
          type="button"
          onClick={() => {
            openPalette();
            onLinkClick?.();
          }}
          title={collapsed ? "Search" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm border border-neutral-200 bg-neutral-50",
            "text-[12px] text-neutral-400 transition-all duration-150",
            "hover:border-neutral-300 hover:bg-paper hover:text-neutral-600",
            collapsed ? "h-9 justify-center" : "h-[30px] px-2.5",
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <PaletteShortcutHint isMac={isMac} />
            </>
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav
        aria-label="Admin navigation"
        className="flex-1 overflow-y-auto px-[10px] pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {NAV.map((section, si) => (
          <div key={section.label} className={si > 0 ? "mt-[14px]" : "mt-1"}>
            {collapsed ? (
              si > 0 && (
                <div className="mx-auto mb-[10px] h-px w-5 bg-neutral-200" />
              )
            ) : (
              <p className="mb-[5px] px-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                {section.label}
              </p>
            )}

            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                if (item.children) {
                  return (
                    <li key={item.href}>
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
                  <li key={item.href}>
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
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div className="shrink-0 border-t border-neutral-100">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-2.5">
            <div
              title={userName}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-accent"
            >
              {initial}
            </div>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Open storefront"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-ink"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-[14px] py-2.5">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-accent">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold leading-tight text-ink">
                {userName}
              </p>
              <p className="truncate text-[11px] capitalize leading-tight text-neutral-400">
                {userRole}
              </p>
            </div>
            <Link
              href="/"
              target="_blank"
              title="Open storefront"
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-ink"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}
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
          "hidden h-full flex-col border-r border-neutral-100 bg-paper transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-[52px]" : "w-[232px]",
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
            "absolute inset-0 bg-neutral-900/50 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onMobileClose}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-neutral-100 bg-paper shadow-2xl",
            "transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
          <SidebarContent collapsed={false} onLinkClick={onMobileClose} />
        </aside>
      </div>
    </>
  );
}

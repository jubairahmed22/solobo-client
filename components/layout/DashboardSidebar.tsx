"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  ShoppingBag,
  Users,
  MessageSquare,
  Coins,
  Receipt,
  Truck,
  Tag,
  Layers,
  BarChart3,
  Image as ImageIcon,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Role } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: Record<Exclude<Role, "guest">, NavItem[]> = {
  user: [
    { href: "/dashboard/user", label: "Overview", icon: Home },
    { href: "/dashboard/user/orders", label: "Orders", icon: ShoppingBag },
    { href: "/dashboard/user/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/user/coins", label: "Loyalty coins", icon: Coins },
    { href: "/dashboard/user/profile", label: "Profile", icon: Settings },
  ],
  admin: [
    { href: "/dashboard/admin", label: "Overview", icon: Home },
    { href: "/dashboard/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/dashboard/admin/customers", label: "Customers", icon: Users },
    { href: "/dashboard/admin/inventory", label: "Inventory", icon: Package },
    { href: "/dashboard/admin/invoices", label: "Invoices", icon: Receipt },
    { href: "/dashboard/admin/delivery", label: "Delivery pricing", icon: Truck },
    { href: "/dashboard/admin/chat", label: "Chat", icon: MessageSquare },
  ],
  superadmin: [
    { href: "/dashboard/superadmin", label: "Overview", icon: Home },
    { href: "/dashboard/superadmin/products", label: "Products", icon: Package },
    { href: "/dashboard/superadmin/categories", label: "Categories", icon: Layers },
    { href: "/dashboard/superadmin/brands", label: "Brands", icon: Tag },
    { href: "/dashboard/superadmin/tags", label: "Tags", icon: Tag },
    { href: "/dashboard/superadmin/banners", label: "Banners", icon: ImageIcon },
    { href: "/dashboard/superadmin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/dashboard/superadmin/customers", label: "Customers", icon: Users },
    { href: "/dashboard/superadmin/analytics", label: "Analytics", icon: BarChart3 },
  ],
};

export interface DashboardSidebarProps {
  role: Exclude<Role, "guest">;
  className?: string;
}

export function DashboardSidebar({ role, className }: DashboardSidebarProps) {
  const pathname = usePathname() ?? "";
  const items = NAV[role];

  return (
    <aside
      className={cn(
        "hidden border-r border-neutral-200 bg-paper md:block md:w-56 md:shrink-0",
        className,
      )}
      aria-label="Dashboard navigation"
    >
      <div className="sticky top-7 flex h-[calc(100vh-3.5rem)] flex-col gap-2 overflow-y-auto p-2">
        <p className="px-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {role}
        </p>
        <nav>
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active =
                pathname === item.href || (item.href !== `/dashboard/${role}` && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-sm transition-colors duration-hover",
                      active
                        ? "bg-ink text-paper"
                        : "text-ink hover:bg-neutral-100",
                    )}
                  >
                    <Icon className="h-2 w-2" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User as UserIcon,
  MapPin,
  Lock,
  ShoppingBag,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavLink {
  href: string;
  label: string;
  // Lucide icons forward refs and use `Booleanish` for aria-hidden - using the
  // shipped `LucideIcon` type avoids a structural-mismatch error when assigning
  // them to a hand-rolled ComponentType<{ aria-hidden?: boolean }>.
  Icon: LucideIcon;
}

const LINKS: NavLink[] = [
  { href: "/account/profile", label: "Profile", Icon: UserIcon },
  { href: "/account/orders", label: "Orders", Icon: ShoppingBag },
  { href: "/account/addresses", label: "Addresses", Icon: MapPin },
  { href: "/account/security", label: "Security", Icon: Lock },
  { href: "/wishlist", label: "Wishlist", Icon: Heart },
];

/**
 * Sticky left rail for /account/*. Highlights the active route by prefix so
 * /account/orders/[id] keeps "Orders" lit. Collapses to a top-of-page row of
 * pills on mobile.
 */
export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="md:sticky md:top-9 md:self-start">
      <nav aria-label="Account navigation">
        <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0 md:pb-0">
          {LINKS.map(({ href, label, Icon }) => {
            const active =
              pathname === href || (href !== "/wishlist" && pathname?.startsWith(`${href}/`));
            return (
              <li key={href} className="shrink-0 md:shrink">
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-hover ease-out",
                    "md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:px-2 md:py-2.5",
                    active
                      ? "border-ink bg-ink text-paper md:border-ink md:bg-transparent md:text-ink md:font-semibold"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-ink md:border-neutral-100 md:hover:bg-neutral-50",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

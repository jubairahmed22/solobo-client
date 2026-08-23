"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  User as UserIcon,
  LayoutDashboard,
  Package,
  Heart,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from "@/components/complex";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api/auth";

/**
 * Account avatar/icon in the navbar.
 * - Anonymous → links to /login (no dropdown).
 * - Loading   → shows a quiet placeholder so we don't flicker between states.
 * - Authed    → opens a dropdown with role-aware items + sign out.
 */
export function UserMenu() {
  const router = useRouter();
  const { status, user, hasRole } = useAuth();

  // Loading: render a static, non-interactive placeholder of the same size.
  if (status === "loading") {
    return (
      <span
        aria-hidden
        className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full text-paper/40"
      >
        <UserIcon className="h-[22px] w-[22px]" />
      </span>
    );
  }

  // Anonymous: simple link.
  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Sign in"
        className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full text-paper transition-colors hover:bg-white/10"
      >
        <UserIcon className="h-[22px] w-[22px]" aria-hidden />
      </Link>
    );
  }

  const dashboardHref =
    hasRole("admin") || hasRole("superadmin") ? "/admin" : "/account";

  const onSignOut = async () => {
    // Best-effort backend logout to invalidate the refresh token cookie.
    try {
      await authApi.logout();
    } catch {
      // ignore - NextAuth signOut still clears the session cookie below.
    }
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label="Account menu"
        className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
      >
        <Avatar
          src={user.image}
          alt={user.name ?? user.email}
          size={32}
          className="h-[32px] w-[32px]"
        />
      </DropdownTrigger>
      {/* Flowbite user dropdown: full-bleed rows on a p-0 panel, 16px muted
          icons, px-4/py-2 items, gray-100 hovers, divided sections. */}
      <DropdownMenu align="end" className="min-w-[224px] rounded-[8px] p-0 shadow-lg">
        <div className="flex flex-col px-[16px] py-[12px]">
          <span className="truncate text-[14px] font-medium text-gray-900">
            {user.name || user.email.split("@")[0]}
          </span>
          <span className="truncate text-[13px] text-gray-500">{user.email}</span>
          {user.role !== "user" ? (
            <span className="mt-[6px] inline-flex w-fit rounded-[4px] bg-gray-100 px-[8px] py-[2px] text-[10px] font-medium uppercase tracking-wide text-gray-800">
              {user.role}
            </span>
          ) : null}
        </div>
        <DropdownSeparator className="my-0 bg-gray-100" />
        <div className="py-[4px]">
          <Link href={dashboardHref} className="block">
            <DropdownItem className="gap-[10px] rounded-none px-[16px] py-[8px] text-[14px] text-gray-700 hover:bg-gray-100 hover:text-gray-900">
              <LayoutDashboard className="h-[16px] w-[16px] text-gray-400" aria-hidden />
              <span>Dashboard</span>
            </DropdownItem>
          </Link>
          <Link href="/account/orders" className="block">
            <DropdownItem className="gap-[10px] rounded-none px-[16px] py-[8px] text-[14px] text-gray-700 hover:bg-gray-100 hover:text-gray-900">
              <Package className="h-[16px] w-[16px] text-gray-400" aria-hidden />
              <span>My orders</span>
            </DropdownItem>
          </Link>
          <Link href="/wishlist" className="block">
            <DropdownItem className="gap-[10px] rounded-none px-[16px] py-[8px] text-[14px] text-gray-700 hover:bg-gray-100 hover:text-gray-900">
              <Heart className="h-[16px] w-[16px] text-gray-400" aria-hidden />
              <span>Wishlist</span>
            </DropdownItem>
          </Link>
          <Link href="/account/profile" className="block">
            <DropdownItem className="gap-[10px] rounded-none px-[16px] py-[8px] text-[14px] text-gray-700 hover:bg-gray-100 hover:text-gray-900">
              <Settings className="h-[16px] w-[16px] text-gray-400" aria-hidden />
              <span>Account settings</span>
            </DropdownItem>
          </Link>
        </div>
        <DropdownSeparator className="my-0 bg-gray-100" />
        <div className="py-[4px]">
          <DropdownItem
            onClick={onSignOut}
            destructive
            className="gap-[10px] rounded-none px-[16px] py-[8px] text-[14px] text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-[16px] w-[16px]" aria-hidden />
            <span>Sign out</span>
          </DropdownItem>
        </div>
      </DropdownMenu>
    </Dropdown>
  );
}

/**
 * Compact "Sign in" button - useful in places where we want an explicit CTA
 * rather than just an avatar icon (e.g. promotional banners).
 */
export function SignInLink({ className }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex items-center gap-0.5 text-sm font-medium text-ink underline-offset-4 hover:underline ${className ?? ""}`}
    >
      <LogIn className="h-4 w-4" aria-hidden />
      <span>Sign in</span>
    </Link>
  );
}

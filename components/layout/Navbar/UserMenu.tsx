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
      <DropdownMenu align="end" className="min-w-[220px]">
        <div className="flex flex-col px-1.5 py-1">
          <span className="truncate text-sm font-medium text-ink">
            {user.name || user.email.split("@")[0]}
          </span>
          <span className="truncate text-xs text-neutral-500">{user.email}</span>
          {user.role !== "user" ? (
            <span className="mt-1 inline-flex w-fit rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink">
              {user.role}
            </span>
          ) : null}
        </div>
        <DropdownSeparator />
        <Link href={dashboardHref} className="block">
          <DropdownItem>
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            <span>Dashboard</span>
          </DropdownItem>
        </Link>
        <Link href="/account/orders" className="block">
          <DropdownItem>
            <Package className="h-4 w-4" aria-hidden />
            <span>My orders</span>
          </DropdownItem>
        </Link>
        <Link href="/wishlist" className="block">
          <DropdownItem>
            <Heart className="h-4 w-4" aria-hidden />
            <span>Wishlist</span>
          </DropdownItem>
        </Link>
        <Link href="/account/profile" className="block">
          <DropdownItem>
            <Settings className="h-4 w-4" aria-hidden />
            <span>Account settings</span>
          </DropdownItem>
        </Link>
        <DropdownSeparator />
        <DropdownItem onClick={onSignOut} destructive>
          <LogOut className="h-4 w-4" aria-hidden />
          <span>Sign out</span>
        </DropdownItem>
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

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldOff } from "lucide-react";
import { Spinner } from "@/components/ui";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const next = pathname ?? "/admin";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Spinner />
      </div>
    );
  }

  const role = session?.user?.role;
  const isAdmin = role === "admin" || role === "superadmin";
  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 p-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-neutral-200 bg-paper shadow-sm">
          <ShieldOff className="h-6 w-6 text-neutral-400" aria-hidden />
        </div>
        <div>
          <p className="text-[17px] font-semibold text-ink">Admin access required</p>
          <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-neutral-500">
            You&rsquo;re signed in, but your account doesn&rsquo;t have admin
            permissions. Contact a platform owner to request access.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-neutral-200 bg-paper px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-ink"
        >
          Back to storefront
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

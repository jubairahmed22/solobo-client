"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Spinner } from "@/components/ui";

/**
 * Client-side auth gate for /account/*. While the session is loading, render a
 * minimal spinner so we don't flash the protected content. If the user is
 * unauthenticated, replace the URL with /login?next=<current> so they bounce
 * back here after sign-in.
 */
export function AccountAuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const next = pathname ?? "/account/profile";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}

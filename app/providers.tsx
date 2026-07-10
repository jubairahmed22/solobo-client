"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, CartSyncBridge } from "@/components/complex";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";

/**
 * App-wide providers. Wraps every page rendered under app/layout.tsx.
 * - SessionProvider: makes NextAuth's useSession() available everywhere.
 * - React Query: 60s stale time keeps things peppy for product lists.
 * - Toaster: single global portal driven by uiStore.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <QueryClientProvider client={client}>
        <CartSyncBridge />
        <AnalyticsProvider />
        {children}
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}

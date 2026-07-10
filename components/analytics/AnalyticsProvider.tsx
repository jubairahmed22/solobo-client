"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { MicrosoftClarity } from "./MicrosoftClarity";

/**
 * Mounts the first-party tracker and auto-fires a page_view on every client
 * navigation. App Router doesn't emit a classic "page load" per route change,
 * so we watch pathname + searchParams and fire when either changes.
 *
 * Rendered once near the root (see app/providers.tsx). Renders nothing.
 */
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    initAnalytics();
  }, []);

  React.useEffect(() => {
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    trackPageView(path, typeof document !== "undefined" ? document.title : undefined);
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider() {
  // useSearchParams requires a Suspense boundary in the App Router; wrapping
  // here keeps the rest of the tree from being forced into client suspense.
  return (
    <>
      <React.Suspense fallback={null}>
        <PageViewTracker />
      </React.Suspense>
      <MicrosoftClarity />
    </>
  );
}

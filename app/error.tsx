"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: pipe to Sentry/observability when wired
    console.error(error);
  }, [error]);

  return (
    <main className="container-screen flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-sm text-neutral-500">500</p>
      <h1>Something went wrong</h1>
      <p className="max-w-prose text-neutral-600">
        An unexpected error occurred. Try again, or head back to the home page.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-neutral-400">ref: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { getSession } from "next-auth/react";
import { Button } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";

/**
 * ExportCsvButton - kicks off a CSV download from one of the export endpoints
 * (e.g. `/api/seller/orders/export.csv`).
 *
 * Why this isn't just an `<a href download>`:
 * The export endpoints sit behind `verifyJWT` and read the access token from
 * the `Authorization` header. A vanilla link click can't add a header, so we
 * fetch the response with auth attached, materialise it as a Blob, and let
 * the browser save it via a synthetic anchor click. The streamed bytes still
 * flow through fetch's ReadableStream → Blob path; we just lose the ability
 * to start writing to disk before the response completes - fine for the
 * spreadsheet-sized exports our SME customers want.
 *
 * Caller passes the API path (e.g. "/seller/orders/export.csv") and the same
 * query params they used to filter the list view; the export endpoints accept
 * the identical filter surface so "what I see is what I export."
 */
export interface ExportCsvButtonProps {
  /** Path relative to the API base, e.g. "/seller/orders/export.csv". */
  path: string;
  /** Filter/sort/search params to forward to the export endpoint. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Suggested download filename. Server-side Content-Disposition wins if set, but this is the fallback. */
  filename?: string;
  /** Optional label override. Defaults to "Export CSV". */
  children?: React.ReactNode;
  /** Disable when the filtered list would be empty (saves a round-trip to a 0-row CSV). */
  disabled?: boolean;
  /** Visual variant - defaults to `secondary` to keep export visually subordinate to primary actions. */
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";

export function ExportCsvButton({
  path,
  params,
  filename,
  children,
  disabled,
  variant = "secondary",
  size = "sm",
  className,
}: ExportCsvButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const toast = useUIStore((s) => s.toast);

  // Build URL once per render. Drop undefined/null/empty values so the export
  // endpoint sees only "real" filters - keeps server logs cleaner and avoids
  // surprises when a Mongoose query treats an empty string as a match.
  const url = React.useMemo(() => {
    const usp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const s = String(v);
        if (s === "") continue;
        usp.set(k, s);
      }
    }
    const qs = usp.toString();
    return `${API_URL}/api${path}${qs ? `?${qs}` : ""}`;
  }, [path, params]);

  const onClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const session = await getSession();
      const token = session?.accessToken;
      if (!token) {
        toast({
          title: "Couldn't export",
          description: "Session expired - sign in again and retry.",
          tone: "error",
        });
        return;
      }
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        // The export endpoints return JSON {success:false,message} on auth or
        // validation errors, so try to surface that. Falls back to status code.
        let message = `Export failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch {
          /* not JSON - keep status fallback */
        }
        toast({ title: "Couldn't export", description: message, tone: "error" });
        return;
      }
      const blob = await res.blob();
      // Prefer server-supplied filename from Content-Disposition. Strict
      // parsing - we only accept `filename="..."` because that's what our
      // helper sets, no RFC 5987 (`filename*=...`) gymnastics needed.
      let downloadName = filename ?? "export.csv";
      const cd = res.headers.get("Content-Disposition");
      if (cd) {
        const m = /filename="?([^";]+)"?/i.exec(cd);
        if (m?.[1]) downloadName = m[1];
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = downloadName;
      // Some browsers require the anchor to be in the DOM before .click()
      // triggers the save dialog.
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer revoke so Safari has time to start the download.
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      toast({
        title: "Export ready",
        description: `Saved ${downloadName}`,
        tone: "success",
      });
    } catch (err) {
      toast({
        title: "Couldn't export",
        description: err instanceof Error ? err.message : "Network error.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || busy}
      loading={busy}
      className={className}
    >
      {!busy ? <Download className="h-2 w-2" aria-hidden /> : null}
      <span>{children ?? "Export CSV"}</span>
    </Button>
  );
}

import "server-only";
import type { SiteSettings } from "@/types/siteSettings";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";

/**
 * Fetch the public SiteSettings singleton server-side (for the policy/contact/
 * FAQ pages). Revalidated every 5 minutes so admin edits propagate quickly
 * without refetching on every request. Returns null on any failure so callers
 * render a graceful fallback instead of a 500.
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const res = await fetch(`${API_URL}/api/site-settings`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: SiteSettings };
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

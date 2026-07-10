import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  resolveLifecycleAction,
  goneHtml,
  type LifecycleInfo,
} from "@/lib/seo/lifecycle";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
/** Hard ceiling on the lifecycle lookup so a slow backend never blocks a PDP. */
const LIFECYCLE_TIMEOUT_MS = 800;

/**
 * Product Lifecycle SEO gate. For `/product/<slug>` we ask the backend for the
 * product's lifecycle state and apply the configured policy (see
 * lib/seo/lifecycle.ts): active → pass, discontinued → 301 to the replacement
 * or 410 Gone. The lookup is cheap (cached, lean projection) and fails OPEN —
 * any error/timeout falls through to a normal render so a backend hiccup can
 * never take the storefront down.
 */
async function handleProductLifecycle(req: NextRequest): Promise<NextResponse> {
  const slug = req.nextUrl.pathname.split("/")[2];
  if (!slug) return NextResponse.next();

  let info: LifecycleInfo;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIFECYCLE_TIMEOUT_MS);
    const res = await fetch(
      `${API_URL}/api/products/${encodeURIComponent(slug)}/lifecycle`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    clearTimeout(timer);
    if (!res.ok) return NextResponse.next();
    const body = (await res.json()) as { success?: boolean; data?: LifecycleInfo };
    if (!body?.success || !body.data) return NextResponse.next();
    info = body.data;
  } catch {
    // Timeout, network error, malformed JSON — fail open.
    return NextResponse.next();
  }

  const action = resolveLifecycleAction(info);
  switch (action.kind) {
    case "redirect":
      return NextResponse.redirect(new URL(action.to, req.nextUrl), action.status);
    case "gone":
      return new NextResponse(goneHtml(), {
        status: action.status,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-robots-tag": "noindex",
        },
      });
    case "pass":
    default:
      return NextResponse.next();
  }
}

/**
 * Edge middleware. Two responsibilities:
 *  1. Product Lifecycle SEO for `/product/*` (runs before auth — no session needed).
 *  2. Dashboard gating for `/dashboard/*` — anonymous users bounce to /login;
 *     role-based section access is re-checked in server components.
 */
export default auth(async (req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  if (path.startsWith("/product/")) {
    return handleProductLifecycle(req as unknown as NextRequest);
  }

  if (!path.startsWith("/dashboard")) return NextResponse.next();

  const isAuthed = Boolean(req.auth?.user?.id);
  const role = req.auth?.user?.role;

  if (!isAuthed) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  // Section gates
  if (path.startsWith("/dashboard/superadmin") && role !== "superadmin") {
    return NextResponse.redirect(new URL("/account", nextUrl));
  }
  if (path.startsWith("/dashboard/admin") && role !== "admin" && role !== "superadmin") {
    return NextResponse.redirect(new URL("/account", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/product/:slug"],
};

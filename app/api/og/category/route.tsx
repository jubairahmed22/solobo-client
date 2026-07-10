import { ImageResponse } from "next/og";
import { ogCard, clampParam } from "@/lib/og/template";

/**
 * GET /api/og/category - dynamic Open Graph image for a category listing.
 *   ?title=…&count=…
 */
export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clampParam(searchParams.get("title"), 90, "Shop by category");
  const count = clampParam(searchParams.get("count"), 12);

  return new ImageResponse(
    ogCard({
      eyebrow: "Category",
      title,
      subtitle: count ? `${count} products` : undefined,
    }),
    SIZE,
  );
}

import { ImageResponse } from "next/og";
import { ogCard, clampParam } from "@/lib/og/template";
import { COMPANY } from "@/lib/entity/company";

/**
 * GET /api/og/blog - dynamic Open Graph image for an editorial / blog page.
 *   ?title=…&author=…&date=
 */
export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clampParam(searchParams.get("title"), 90, `${COMPANY.name} Journal`);
  const author = clampParam(searchParams.get("author"), 40);
  const date = clampParam(searchParams.get("date"), 24);

  return new ImageResponse(
    ogCard({
      eyebrow: "Journal",
      title,
      subtitle: author ? `By ${author}` : undefined,
      meta: date || undefined,
    }),
    SIZE,
  );
}

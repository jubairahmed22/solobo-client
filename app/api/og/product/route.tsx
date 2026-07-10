import { ImageResponse } from "next/og";
import { ogCard, clampParam } from "@/lib/og/template";
import { COMPANY } from "@/lib/entity/company";

/**
 * GET /api/og/product - dynamic Open Graph image for a product.
 *
 * Edge runtime + the next/og (@vercel/og) engine. Data is passed via query
 * params by `productMetadata` so the edge handler never touches the DB:
 *   ?title=…&brand=…&price=…&rating=…
 */
export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clampParam(searchParams.get("title"), 90, `Shop ${COMPANY.name}`);
  const brand = clampParam(searchParams.get("brand"), 40);
  const price = clampParam(searchParams.get("price"), 24);
  const rating = clampParam(searchParams.get("rating"), 12);

  return new ImageResponse(
    ogCard({
      eyebrow: brand || "Product",
      title,
      subtitle: price ? `Tk ${price}` : undefined,
      meta: rating ? `★ ${rating}` : undefined,
    }),
    SIZE,
  );
}

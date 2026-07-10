/**
 * Shared visual template for dynamically-generated Open Graph images.
 *
 * Rendered by the `next/og` `ImageResponse` engine (the @vercel/og runtime
 * bundled with Next.js) inside the edge route handlers under `app/api/og/*`.
 * Everything here is plain inline-styled JSX - Satori (the engine) supports a
 * flexbox subset only, so every container with >1 child must set
 * `display: "flex"` and there is no CSS cascade. Keep text Latin (the default
 * font has no Bengali glyphs) - prices use "Tk", not "৳".
 */

const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const MUTED = "#A3A3A3";

export interface OgCardProps {
  /** Small uppercase label above the title (category name, "Product", etc.). */
  eyebrow?: string;
  title: string;
  /** Secondary line under the title (price, product count, author…). */
  subtitle?: string;
  /** Bottom-right meta (e.g. rating, date). */
  meta?: string;
}

/** The branded 1200×630 card. Returns a JSX element for ImageResponse. */
export function ogCard({ eyebrow, title, subtitle, meta }: OgCardProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: INK,
        color: PAPER,
        padding: "72px",
        fontFamily: "sans-serif",
      }}
    >
      {/* Header: wordmark */}
      <div style={{ display: "flex", alignItems: "center", fontSize: 32, letterSpacing: "0.08em" }}>
        <span style={{ fontWeight: 700 }}>SOLOBO</span>
      </div>

      {/* Body: eyebrow + title + subtitle */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: MUTED,
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontSize: title.length > 60 ? 64 : 80,
            fontWeight: 700,
            lineHeight: 1.05,
            // Satori clamps overflow; we also hard-trim upstream.
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ display: "flex", fontSize: 40, color: PAPER, marginTop: 28 }}>{subtitle}</div>
        ) : null}
      </div>

      {/* Footer: thin rule + meta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid #262626`,
          paddingTop: 28,
          fontSize: 28,
          color: MUTED,
        }}
      >
        <span style={{ display: "flex" }}>solobo.com.bd</span>
        {meta ? <span style={{ display: "flex" }}>{meta}</span> : <span style={{ display: "flex" }} />}
      </div>
    </div>
  );
}

/** Hard-trim a query param to a safe length for the card. */
export function clampParam(value: string | null, max: number, fallback = ""): string {
  if (!value) return fallback;
  const t = value.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

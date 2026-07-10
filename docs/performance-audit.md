# Performance Audit — Solobo Storefront

**Scope:** Next.js 14 App Router storefront (`frontend/`). Reviews the four Core
Web Vitals (LCP, CLS, INP, TTFB) plus `next/image`, font loading, script
loading, hydration, and bundle size.

**Status legend:** ✅ already good · 🟠 fix recommended · 🔴 high-impact issue ·
🛠️ **fixed in this change**

> Fixes marked 🛠️ were applied as part of this audit (the "safe fixes" tranche).
> Everything else is a recommendation, ordered by impact.

---

## Summary of findings

| Area | Verdict | Headline |
| --- | --- | --- |
| TTFB | 🔴 → 🛠️ | Every dynamic route fetched its primary resource **twice** per request (metadata + body). Fixed with `React.cache`. |
| LCP | 🟠 → 🛠️ | Hero images already use `priority`+`sizes`; added image-CDN `preconnect` and longer optimized-image cache. |
| CLS | ✅ | `next/font` + `fill` images in sized boxes. No major shift sources found. |
| INP | 🟠 | A few heavy client islands hydrate eagerly; documented, not changed. |
| next/image | ✅ → 🛠️ | avif/webp on; `minimumCacheTTL` raised 60s → 1 day. |
| Fonts | ✅ | Self-hosted Inter via `next/font`, `display: swap`. |
| Scripts | ✅ | GTM/GA Consent Mode v2 ordering is correct. |
| Hydration | ✅ | Count badges use a mounted-guard to avoid mismatch. |
| Bundle | 🟠 | `framer-motion` is the largest client dep; `optimizePackageImports` already on. |

---

## 1. TTFB

### 🔴→🛠️ Duplicate data fetch per request (primary finding)
Every dynamic route defined a plain `async function fetchX()` and called it
**once in `generateMetadata` and again in the page body**. Server Components and
`generateMetadata` do not share a request memo for arbitrary functions, so this
was two identical backend round-trips on every product, category, brand, offer,
and store page — directly inflating TTFB.

**Fix applied:** wrapped each primary fetcher in `React.cache(...)`, which memoizes
per request so metadata and body share one call:
- `app/product/[slug]/page.tsx` — `fetchProduct`
- `app/category/[...slug]/page.tsx` — `fetchCategory`
- `app/brands/[slug]/page.tsx` — `fetchBrand`
- `app/offers/[slug]/page.tsx` — `fetchOffer`
- `app/store/[slug]/page.tsx` — `fetchStore` (keyed on slug+page)

### ✅ Backend response caching
Public reads already go through a short-TTL `cache` middleware
(`backend/src/routes/product.routes.ts`: list 120s, featured/related 300s, item
120s). The new lifecycle probe reuses it (120s).

### 🟠 Lifecycle middleware lookup (introduced by Part 1)
The Product-Lifecycle-SEO middleware adds one `fetch` to
`/api/products/:slug/lifecycle` per PDP visit. Mitigations already in place:
backend response is cached (120s), the projection is tiny (`slug
lifecycleStatus replacedBy`), and the call has an 800ms timeout that **fails
open**. *Recommendation:* if PDP TTFB regresses under load, add a short
`Cache-Control: s-maxage` header to the lifecycle endpoint so a CDN/edge cache
absorbs it, or cache the fetch in the middleware via the Web Cache API.

### 🟠 axios vs native fetch
SSR fetchers use `axios`, which can't participate in Next's fetch cache/ISR
tagging. `React.cache` covers per-request dedup, but switching to native `fetch`
with `next: { revalidate }` would unlock route-level data caching. *Higher-risk;
recommended, not applied.*

---

## 2. LCP (Largest Contentful Paint)

### ✅ Hero images
- PDP hero (`app/product/[slug]/ProductDetailClient.tsx`): `priority` + correct
  responsive `sizes="(min-width:1024px) 42vw, (min-width:768px) 50vw, 100vw"`.
- Homepage banner (`components/composed/OfferBannerCarousel.tsx`): first slide
  gets `priority={i === 0}` ✓; other slides lazy.
- `ProductCard` images carry a responsive `sizes`.

### 🛠️ CDN preconnect
Added `<link rel="preconnect" href="https://res.cloudinary.com">` (+ dns-prefetch)
in `app/layout.tsx` so the TLS handshake to the image host overlaps earlier work
— removes a round-trip before the hero image byte stream starts.

### 🛠️ Optimized-image cache
`next.config.mjs` `images.minimumCacheTTL` raised `60` → `86400`. Product
imagery is effectively immutable (Cloudinary URLs are versioned), so a 1-minute
re-optimization window was wasteful and hurt repeat-view LCP.

### 🟠 Recommendation
Consider an explicit `quality` on the hero `<Image>` and verify the LCP element
on slow 3G via Lighthouse (record numbers in the table below once measured).

---

## 3. CLS (Cumulative Layout Shift)

### ✅ Fonts
`next/font/google` Inter with `display: swap` and a CSS variable. `next/font`
auto-applies a size-adjusted fallback, so the swap doesn't shift layout.

### ✅ Images
All `next/image` usages reviewed use `fill` inside aspect-ratio'd containers, so
the box is reserved before load — no reflow.

### 🟠 Recommendation
Audit any client-rendered banners/toasts/`FloatingWidgets` that mount after
hydration to ensure they're absolutely positioned (they appear to be) and never
push content. Reserve space for async rating/stock rows on the PDP if a shift is
observed in field data.

---

## 4. INP (Interaction to Next Paint)

### 🟠 Heavy client islands
`ProductDetailClient`, the Navbar mega-menu (`CategoryMenu`), and
`NotificationsBell` are sizeable `"use client"` components that hydrate on load.
On low-end devices this can delay first interaction.

*Recommendations (not applied — needs profiling):*
- Defer non-critical islands (`NotificationsBell`, `FloatingWidgets`) with
  `next/dynamic({ ssr: false })` so they don't compete with first interaction.
- Keep event handlers cheap; debounce already used in search (`useDebounce`) ✓.

---

## 5. next/image

✅ `formats: ["image/avif", "image/webp"]`, remote patterns scoped to the hosts
in use. 🛠️ `minimumCacheTTL` bumped (see §2). No raw `<img>` on hot paths except
the admin `ProductSelector` rows (intentional — arbitrary hosts, off the
storefront critical path).

---

## 6. Font loading
✅ Single self-hosted family (Inter) via `next/font`, weights 400/500/600/700,
`display: swap`, preloaded automatically. 🟠 If a Lighthouse "unused
preload"/bundle check flags it, drop any weight not actually rendered (e.g. 500)
to shave font payload — verify usage first.

## 7. Script loading
✅ `components/analytics/GoogleTagManager.tsx` is exemplary: Consent Mode v2
defaults inline `beforeInteractive`, GTM container `afterInteractive`, `<noscript>`
iframe at top of `<body>`. No render-blocking third-party scripts found.

## 8. Hydration
✅ `NavIcon` (cart/wishlist counts) guards client-only values behind a `mounted`
flag, avoiding server/client text mismatches. No other obvious mismatch sources.

## 9. Bundle size
✅ `experimental.optimizePackageImports: ["lucide-react", "framer-motion"]` keeps
icon/animation tree-shaking tight; `poweredByHeader: false`, `compress: true`.
🟠 `framer-motion` is the heaviest client dependency — if motion is used in only
a few spots, prefer CSS transitions or import the lighter `m` component with
`LazyMotion` to cut the baseline JS. *Recommended; not applied.*

---

## Fixes applied in this change
1. `React.cache` dedup on all five dynamic-route primary fetchers (TTFB). 🛠️
2. Cloudinary `preconnect` + `dns-prefetch` in the root layout (LCP). 🛠️
3. `images.minimumCacheTTL` 60s → 86400s (LCP / image-server CPU). 🛠️

## Recommended next (not applied — higher risk / needs measurement)
- Migrate SSR `axios` fetchers to native `fetch` with `revalidate` tags.
- `next/dynamic` defer for `NotificationsBell` / `FloatingWidgets` (INP).
- `LazyMotion` for `framer-motion`, or trim to CSS where possible (bundle).
- Drop unused Inter weights after confirming usage.
- Add `s-maxage` to the lifecycle endpoint if PDP TTFB regresses under load.

## How to measure (before/after)
```bash
cd frontend && npm run build && npm start    # production build is required for real numbers
# then, against a running instance:
npx lighthouse http://localhost:3000/ --only-categories=performance --view
npx lighthouse http://localhost:3000/product/<a-real-slug> --only-categories=performance --view
```
Record LCP / CLS / INP (or TBT as proxy) / TTFB here:

| Page | LCP | CLS | INP/TBT | TTFB | Date |
| --- | --- | --- | --- | --- | --- |
| `/` | — | — | — | — | — |
| `/product/<slug>` | — | — | — | — | — |

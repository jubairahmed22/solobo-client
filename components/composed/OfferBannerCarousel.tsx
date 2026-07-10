"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OfferBanner } from "@/types/offer";

/**
 * OfferBannerCarousel - read-only banner carousel used across the storefront
 * (offer landing page, homepage hero rotation, category top strip). Auto-
 * advances every 5s when there's more than one slide and pauses while the
 * user is hovering (desktop) or interacting (mobile dots).
 *
 * The component intentionally accepts a *flat* `banners` array. Filtering by
 * `isActive` is the caller's job - the offer detail endpoint already drops
 * inactive slides for the public surface, but the admin preview embed should
 * be free to render everything in-place.
 *
 * Layout: a 16:5 hero on desktop that collapses to 4:3 on narrow screens so
 * we don't lose the title/subtitle to letterboxing. The CTA renders as a
 * solid pill on the bottom-left of the slide; the right side gets a soft
 * gradient overlay so light backgrounds don't swallow the text.
 *
 * Link rendering follows the same rule as the admin manager: absolute URLs
 * open in a new tab via <a>, internal paths use Next's <Link>. That keeps
 * external campaign URLs (Shop now → partner site) from blowing through the
 * SPA router.
 */
export interface OfferBannerCarouselProps {
  banners: OfferBanner[];
  /** Override auto-advance interval in ms. Pass 0 to disable. Default 5000. */
  autoplayMs?: number;
  /** Tone for the gradient overlay - defaults to dark text on light image. */
  overlay?: "dark" | "light";
  /** Aspect ratio class override (e.g. `aspect-[21/9]`). */
  aspectClassName?: string;
  className?: string;
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function OfferBannerCarousel({
  banners,
  autoplayMs = 5000,
  overlay = "dark",
  aspectClassName,
  className,
}: OfferBannerCarouselProps) {
  const slides = React.useMemo(
    () => banners.filter((b) => b.isActive).sort((a, b) => a.order - b.order),
    [banners],
  );

  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);

  // Clamp the active index if the slide array shrinks (e.g. live edit).
  React.useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  // Auto-advance - only when there are multiple slides and autoplay is on.
  React.useEffect(() => {
    if (slides.length <= 1 || autoplayMs <= 0 || paused) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, autoplayMs);
    return () => window.clearTimeout(id);
  }, [slides.length, autoplayMs, paused, index]);

  if (slides.length === 0) return null;

  // Index is clamped via the effect above, but TS still narrows `slides[index]`
  // to `OfferBanner | undefined`. Fall back to the first slide as a safety net
  // for the brief render between a shrink and the clamp effect firing.
  const current: OfferBanner = slides[index] ?? slides[0]!;
  const next = () => setIndex((i) => (i + 1) % slides.length);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
      if (Math.abs(delta) > 40) {
        if (delta > 0) prev();
        else next();
      }
    }
    touchStartX.current = null;
    setPaused(false);
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-neutral-100",
        aspectClassName ?? "aspect-[4/3] md:aspect-[16/5]",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
    >
      {/* Slides - render all and crossfade via opacity so Image components
          don't unmount/remount and lose their cached pixels. */}
      {slides.map((slide, i) => (
        <BannerSlide
          key={slide._id}
          slide={slide}
          active={i === index}
          overlay={overlay}
          priority={i === 0}
        />
      ))}

      {/* Prev/next arrows - only when there's more than one slide */}
      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-paper/80 text-ink shadow-md backdrop-blur-sm transition-colors duration-hover ease-out hover:bg-paper sm:inline-flex sm:h-9 sm:w-9"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-paper/80 text-ink shadow-md backdrop-blur-sm transition-colors duration-hover ease-out hover:bg-paper sm:inline-flex sm:h-9 sm:w-9"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </>
      ) : null}

      {/* Indicator dots */}
      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide._id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-hover ease-out",
                i === index ? "w-6 bg-paper" : "w-2 bg-paper/60 hover:bg-paper/90",
              )}
            />
          ))}
        </div>
      ) : null}

      {/* Live region for screen readers */}
      <span className="sr-only" aria-live="polite">
        Slide {index + 1} of {slides.length}: {current.title ?? "Offer banner"}
      </span>
    </div>
  );
}

/* ───────────────────── Slide ───────────────────── */

interface BannerSlideProps {
  slide: OfferBanner;
  active: boolean;
  overlay: "dark" | "light";
  priority: boolean;
}

function BannerSlide({ slide, active, overlay, priority }: BannerSlideProps) {
  const hasCta = Boolean(slide.ctaLabel && slide.ctaHref);
  const overlayClass =
    overlay === "dark"
      ? "bg-gradient-to-r from-ink/60 via-ink/20 to-transparent text-paper"
      : "bg-gradient-to-r from-paper/70 via-paper/20 to-transparent text-ink";

  // The whole slide is clickable when the banner has a CTA - the embedded
  // CTA pill stays as a visual affordance only.
  const linkHref = hasCta ? slide.ctaHref! : null;

  const body = (
    <div className="absolute inset-0">
      {/* Art direction: swap image on mobile vs desktop when a mobile-specific
          image has been uploaded. The browser loads only the matched source. */}
      <picture className="absolute inset-0 block h-full w-full">
        {slide.mobileImage ? (
          <source media="(max-width: 639px)" srcSet={slide.mobileImage} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.image}
          alt={slide.title ?? "Offer banner"}
          className="h-full w-full object-cover"
          loading={priority ? "eager" : "lazy"}
        />
      </picture>
      {/* <div className={cn("absolute inset-0", overlayClass)} aria-hidden /> */}

      <div className={cn("absolute inset-0 flex flex-col justify-center gap-1.5 p-4 md:p-6 lg:p-10", overlay === "dark" ? "text-paper" : "text-ink")}>
        {slide.title ? (
          <h3 className="max-w-[85%] text-balance text-lg font-bold leading-tight drop-shadow md:max-w-[55%] md:text-3xl lg:text-4xl">
            {slide.title}
          </h3>
        ) : null}
        {slide.subtitle ? (
          <p className="max-w-[85%] text-xs opacity-90 drop-shadow md:max-w-[55%] md:text-base">
            {slide.subtitle}
          </p>
        ) : null}
        {/* {hasCta ? (
          <span className="mt-0.5 inline-flex h-4 w-fit items-center justify-center rounded-sm bg-paper px-1.5 text-sm font-medium text-ink shadow-sm">
            {slide.ctaLabel}
          </span>
        ) : null} */}
      </div>
    </div>
  );

  const wrapperClass = cn(
    "absolute inset-0 transition-opacity duration-300 ease-out",
    active ? "opacity-100" : "pointer-events-none opacity-0",
  );

  if (!linkHref) {
    return <div className={wrapperClass}>{body}</div>;
  }

  if (isExternal(linkHref)) {
    return (
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={linkHref} className={wrapperClass}>
      {body}
    </Link>
  );
}

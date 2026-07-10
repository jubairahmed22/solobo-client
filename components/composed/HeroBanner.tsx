import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface HeroBannerProps {
  eyebrow?: string;
  headline: string;
  body?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  className?: string;
}

/**
 * HeroBanner - full-width athletic hero. Dark background with red CTA,
 * bold uppercase headline, and a geometric SVG panel. Gymshark-inspired.
 */
export function HeroBanner({
  eyebrow,
  headline,
  body,
  primaryCta,
  secondaryCta,
  className,
}: HeroBannerProps) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden bg-ink text-paper",
        "px-4 py-8 md:px-10 md:py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:py-20",
        className,
      )}
    >
      {/* Left - copy */}
      <div className="flex max-w-2xl flex-col gap-4 relative z-10">
        {eyebrow ? (
          <span className="inline-flex items-center gap-2 w-fit bg-accent/10 border border-accent/40 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
            {eyebrow}
          </span>
        ) : null}

        <h1 className="text-balance text-4xl font-black uppercase leading-none tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          {headline}
        </h1>

        {body ? (
          <p className="text-base leading-relaxed text-neutral-300 md:text-lg max-w-lg">
            {body}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {primaryCta ? (
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-2 bg-accent px-6 py-3 text-sm font-bold uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center gap-2 border border-paper/40 px-6 py-3 text-sm font-bold uppercase tracking-widest text-paper transition-colors hover:border-paper hover:bg-white/5"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>

      {/* Right - decorative geometric panel */}
      <div className="relative hidden aspect-square w-[32rem] shrink-0 lg:block" aria-hidden>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" fill="none">
          <defs>
            <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5332A" strokeWidth="0.3" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#hero-grid)" />
          {/* Outer ring */}
          <circle cx="200" cy="200" r="160" stroke="#E5332A" strokeWidth="0.5" fill="none" opacity="0.2" />
          {/* Middle ring */}
          <circle cx="200" cy="200" r="100" stroke="#E5332A" strokeWidth="1" fill="none" opacity="0.4" />
          {/* Inner filled accent circle */}
          <circle cx="200" cy="200" r="40" fill="#E5332A" opacity="0.15" />
          <circle cx="200" cy="200" r="4" fill="#E5332A" />
          {/* Diagonal accent lines */}
          <line x1="60" y1="60" x2="340" y2="340" stroke="#E5332A" strokeWidth="0.5" opacity="0.15" />
          <line x1="340" y1="60" x2="60" y2="340" stroke="#E5332A" strokeWidth="0.5" opacity="0.15" />
        </svg>
      </div>

      {/* Background accent glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, #E5332A 0%, transparent 65%)" }}
        aria-hidden
      />
      {/* Bottom-left counter-glow */}
      <div
        className="pointer-events-none absolute -bottom-32 -left-16 h-[300px] w-[300px] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, #E5332A 0%, transparent 70%)" }}
        aria-hidden
      />
    </section>
  );
}

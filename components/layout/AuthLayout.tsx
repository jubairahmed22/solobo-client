import * as React from "react";
import Link from "next/link";
import { COMPANY } from "@/lib/entity/company";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  /** Bottom CTA - e.g. "Don't have an account? Sign up". */
  altPrompt?: { question: string; ctaLabel: string; ctaHref: string };
  children: React.ReactNode;
}

/**
 * Centered single-column auth shell - used by login/register/forgot-password.
 * Mobile-first: full-width up to 360px; max-width 400px on md+.
 */
export function AuthLayout({ title, subtitle, altPrompt, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="container-screen flex h-14 items-center">
        <Link href="/" className="text-base font-semibold tracking-tight" aria-label={`${COMPANY.name} home`}>
          {COMPANY.name}
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-4 md:items-center md:pt-0">
        <div className="w-full max-w-[420px]">
          <div className="mb-5 flex flex-col gap-1 text-left md:text-center">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
          </div>
          {children}
          {altPrompt ? (
            <p className="mt-3 text-center text-sm text-neutral-600">
              {altPrompt.question}{" "}
              <Link href={altPrompt.ctaHref} className="font-medium text-ink underline-offset-4 hover:underline">
                {altPrompt.ctaLabel}
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

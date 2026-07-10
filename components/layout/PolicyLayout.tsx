import * as React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Breadcrumb } from "@/components/composed";

/**
 * Shared shell for the static content pages (Shipping, Returns, Terms, FAQ,
 * Contact). Storefront chrome + a white content card on the grey page, matching
 * the rest of the site. Server component - pages pass already-fetched content.
 */
export function PolicyLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-2">
        <div className="mx-auto max-w-3xl rounded bg-white p-2 sm:p-4 md:p-6">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: title }]} />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          {intro ? <p className="mt-1 text-sm text-neutral-600">{intro}</p> : null}
          <div className="mt-3 sm:mt-4">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Friendly placeholder when an admin hasn't filled a policy page yet. */
export function PolicyEmpty({ note }: { note?: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
      {note ?? "This page hasn't been published yet. Please check back soon."}
    </div>
  );
}

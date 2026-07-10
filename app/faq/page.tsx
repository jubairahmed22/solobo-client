import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { Markdown } from "@/components/composed";
import { FaqJsonLd } from "@/components/seo";
import { PolicyLayout, PolicyEmpty } from "@/components/layout/PolicyLayout";
import { contentMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/siteSettings.server";
import { COMPANY } from "@/lib/entity/company";

export const revalidate = 300;

export const metadata: Metadata = contentMetadata({
  title: "Frequently Asked Questions",
  description: `Answers to common questions about ordering, shipping and returns at ${COMPANY.name}.`,
  path: "/faq",
});

export default async function FaqPage() {
  const settings = await getSiteSettings();
  const faqs = (settings?.faqs ?? []).filter((f) => f.question && f.answer);

  return (
    <PolicyLayout
      title="Frequently Asked Questions"
      intro={faqs.length > 0 ? "Tap a question to see the answer." : undefined}
    >
      {faqs.length === 0 ? (
        <PolicyEmpty note="No FAQs have been published yet." />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {faqs.map((f, i) => (
              <li key={f._id ?? i}>
                {/* Native <details> - accessible + works without JS. */}
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-3.5 text-sm font-medium text-ink hover:bg-neutral-50">
                    {f.question}
                    <ChevronDown
                      className="h-[18px] w-[18px] shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                    <Markdown content={f.answer} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {/* schema.org FAQPage for rich results / AI engines. */}
          <FaqJsonLd items={faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
        </>
      )}
    </PolicyLayout>
  );
}

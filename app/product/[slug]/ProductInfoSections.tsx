import * as React from "react";
import Link from "next/link";
import { Plus, RotateCcw, Shield, Truck } from "lucide-react";
import { FaqJsonLd } from "@/components/seo";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ProductDetail } from "@/types/catalog";
import type { SiteSettings } from "@/types/siteSettings";

/**
 * Server-rendered, AI-friendly product information.
 *
 * Pure SERVER component — no "use client". Emits semantic HTML (dl, details/summary)
 * that search/AI crawlers extract directly from the initial response.
 */

export interface ProductInfoSectionsProps {
  product: ProductDetail;
  settings: SiteSettings | null;
  className?: string;
}

/**
 * Barca/Fanatics-style accordion row. Uses native <details>/<summary> so it
 * works without client JS and stays AI-crawlable. The "+" rotates 45° into an
 * "×" when open.
 */
function AccordionRow({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-b border-neutral-200" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">{title}</h2>
        <Plus
          className="h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-200 group-open:rotate-45"
          aria-hidden
        />
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}

function Spec({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-neutral-100 py-2.5 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="self-start pt-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{term}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

const POLICY_ICONS: ReadonlyArray<React.ComponentType<any>> = [Truck, RotateCcw, Shield]; // eslint-disable-line @typescript-eslint/no-explicit-any
const POLICY_HEADINGS = ["Shipping", "Returns", "Warranty & authenticity"] as const;
const POLICY_FALLBACKS = [
  "Nationwide delivery across Bangladesh. Cash on delivery available; free Dhaka shipping over Tk 1,500.",
  "7-day return window on eligible, unused items in original packaging.",
  "100% authentic products sourced from authorized channels. Manufacturer warranty applies where offered; damaged-on-arrival items are covered by our returns policy.",
] as const;

const POLICY_COLORS = [
  { bg: "bg-blue-50", icon: "text-blue-500" },
  { bg: "bg-amber-50", icon: "text-amber-500" },
  { bg: "bg-green-50", icon: "text-green-600" },
] as const;

export function ProductInfoSections({ product, settings, className }: ProductInfoSectionsProps) {
  const brandName =
    typeof product.brand === "object" && product.brand ? product.brand.name : undefined;
  const categoryName =
    typeof product.category === "object" && product.category ? product.category.name : undefined;
  const sku = product.variants.find((v) => v.sku)?.sku;
  const inStock = product.stock > 0;
  const attributes = product.attributes ?? {};
  const summary = product.description ?? product.shortDescription;

  const shipping = settings?.shippingDetails?.trim();
  const returns = settings?.returnPolicy?.trim();
  const faqs = (settings?.faqs ?? []).filter((f) => f.question && f.answer);

  const policyContent = [
    shipping || POLICY_FALLBACKS[0],
    returns || POLICY_FALLBACKS[1],
    POLICY_FALLBACKS[2],
  ];

  return (
    <section
      className={cn("border-t border-neutral-200", className)}
      aria-label="Product information"
    >

      {/* ── Description ──────────────────────────────────────────────── */}
      {summary ? (
        <AccordionRow title="Description" defaultOpen>
          <p className="text-sm leading-relaxed text-neutral-600 whitespace-pre-line">
            {summary}
          </p>
        </AccordionRow>
      ) : null}

      {/* ── Specifications ────────────────────────────────────────────── */}
      <AccordionRow title="Specifications">
        <dl className="text-sm">
          {brandName ? <Spec term="Brand">{brandName}</Spec> : null}
          {categoryName ? <Spec term="Category">{categoryName}</Spec> : null}
          {sku ? (
            <Spec term="SKU">
              <span className="break-all font-mono text-xs tracking-wide">{sku}</span>
            </Spec>
          ) : null}
          <Spec term="Price">{formatPrice(product.price, product.currency)}</Spec>
          <Spec term="Availability">
            <span className={cn("font-semibold", inStock ? "text-green-700" : "text-red-600")}>
              {inStock ? "In stock" : "Out of stock"}
            </span>
          </Spec>
          {Object.entries(attributes).map(([k, v]) => (
            <Spec key={k} term={k}>{v}</Spec>
          ))}
          {product.tags.length > 0 ? (
            <Spec term="Tags">
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/all-products?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </Spec>
          ) : null}
        </dl>
      </AccordionRow>

      {/* ── Shipping & returns ───────────────────────────────────────── */}
      <AccordionRow title="Shipping and returns">
        <div className="flex flex-col gap-4">
          {POLICY_HEADINGS.map((heading, idx) => {
            const Icon = POLICY_ICONS[idx];
            if (!Icon) return null;
            const colors = POLICY_COLORS[idx]!;
            return (
              <div key={heading} className="flex gap-3">
                <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", colors.bg)}>
                  <Icon className={cn("h-4 w-4", colors.icon)} aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">{heading}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">{policyContent[idx]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </AccordionRow>

      {/* ── FAQ — accordion row + JSON-LD ────────────────────────────── */}
      {faqs.length > 0 ? (
        <AccordionRow title="Frequently asked questions">
          <div className="flex flex-col divide-y divide-neutral-100">
            {faqs.map((f, i) => (
              <div key={f._id ?? i} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-ink">{f.question}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 whitespace-pre-line">
                  {f.answer}
                </p>
              </div>
            ))}
          </div>
          <FaqJsonLd items={faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
        </AccordionRow>
      ) : null}

    </section>
  );
}

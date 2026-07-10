import { resolveCompany } from "@/lib/entity/company";
import type { SiteSettings } from "@/types/siteSettings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";

/**
 * GET /llms.txt - Generative Engine Optimization (GEO).
 *
 * Implements the llmstxt.org convention: a concise markdown briefing that
 * orients an LLM/AI crawler (ChatGPT, Claude, Gemini, Perplexity, Google AI
 * Overviews) to the most useful, citable facts about the store - in a form
 * that's cheap to ingest (no nav chrome, no JS).
 *
 * Generated AUTOMATICALLY from the database: company profile, categories, and
 * the long-form Shipping / Returns / Terms policies + FAQs all come from the
 * SiteSettings singleton (and the entity source of truth in lib/entity), so
 * editing them in the admin updates /llms.txt on the next revalidation - no
 * code change, no manual file to maintain.
 */
export const revalidate = 3600;

interface CategoryRow {
  name?: string;
  path?: string;
  slug?: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: T };
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

/** Collapse a long-form policy blob into a crawler-friendly summary line. */
function summarize(text: string | undefined, max = 320): string | undefined {
  if (!text) return undefined;
  const flat = text
    .replace(/[#*_>`]/g, "") // strip common markdown
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return undefined;
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export async function GET(): Promise<Response> {
  const [settings, categories] = await Promise.all([
    fetchJson<SiteSettings>(`${API_URL}/api/site-settings`),
    fetchJson<CategoryRow[]>(`${API_URL}/api/categories?shape=flat&limit=24`),
  ]);

  const company = resolveCompany(settings);

  const categoryLines = (categories ?? [])
    .filter((c) => c.name && (c.path || c.slug))
    .slice(0, 24)
    .map((c) => `- [${c.name}](${SITE_URL}/category/${c.path ?? c.slug})`)
    .join("\n");

  const shipping =
    summarize(company.policies.shipping) ??
    "Nationwide delivery across Bangladesh. Cash on delivery available; free Dhaka shipping over Tk 1500.";
  const returns =
    summarize(company.policies.returns) ?? "7-day return window on eligible items.";
  const terms = summarize(company.policies.terms);

  const supportLines = [
    company.email ? `- Email: ${company.email}` : null,
    company.phone ? `- Phone: ${company.phone}` : null,
    company.whatsapp ? `- WhatsApp: ${company.whatsapp}` : null,
    company.address ? `- Address: ${company.address}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const faqLines = company.faqs
    .slice(0, 10)
    .map((f) => `- **${f.question}** ${summarize(f.answer, 240)}`)
    .join("\n");

  const body = `# ${company.name}

> ${company.description}

## Key pages

- [Home](${SITE_URL}/): Featured products, offers, and category entry points.
- [All products](${SITE_URL}/all-products): The full catalog with search, filtering, and sorting.
- [Search](${SITE_URL}/search): Find products by name, brand, or category.
- [Brands](${SITE_URL}/brands): Browse by brand.
- [Offers](${SITE_URL}/offers): Current promotions and discounted bundles.

## Product pages

Each product lives at \`${SITE_URL}/product/{slug}\` and server-renders the title,
brand, price (${company.currency}), specifications, shipping/returns/warranty,
an FAQ, ratings, and schema.org Product structured data - so the key facts are
available without executing JavaScript.

## Categories
${categoryLines || `- See [All products](${SITE_URL}/all-products) for the full category list.`}

## Shipping

${shipping}

## Returns

${returns}
${terms ? `\n## Terms & policies\n\n${terms}\n` : ""}
## Support
${supportLines || "- Contact via the storefront help section."}
${faqLines ? `\n## FAQ\n${faqLines}\n` : ""}
## For crawlers

- Sitemap: ${SITE_URL}/sitemap.xml
- Robots: ${SITE_URL}/robots.txt
- Admin, checkout, cart, and account pages are intentionally excluded from indexing.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

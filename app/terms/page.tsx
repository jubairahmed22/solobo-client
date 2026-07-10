import type { Metadata } from "next";
import { Markdown } from "@/components/composed";
import { PolicyLayout, PolicyEmpty } from "@/components/layout/PolicyLayout";
import { contentMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/siteSettings.server";
import { COMPANY } from "@/lib/entity/company";

export const revalidate = 300;

export const metadata: Metadata = contentMetadata({
  title: "Terms & Conditions",
  description: `The terms governing use of ${COMPANY.name} and your purchases.`,
  path: "/terms",
});

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const content = settings?.termsAndConditions?.trim();

  return (
    <PolicyLayout title="Terms & Conditions">
      {content ? (
        <Markdown content={content} />
      ) : (
        <PolicyEmpty note="Terms & conditions haven't been published yet." />
      )}
    </PolicyLayout>
  );
}

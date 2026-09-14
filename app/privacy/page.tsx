import type { Metadata } from "next";
import { Markdown } from "@/components/composed";
import { PolicyLayout, PolicyEmpty } from "@/components/layout/PolicyLayout";
import { contentMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/siteSettings.server";
import { COMPANY } from "@/lib/entity/company";

export const revalidate = 300;

export const metadata: Metadata = contentMetadata({
  title: "Privacy Policy",
  description: `How ${COMPANY.name} collects, uses, and protects your information.`,
  path: "/privacy",
});

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const content = settings?.privacyPolicy?.trim();

  return (
    <PolicyLayout title="Privacy Policy">
      {content ? (
        <Markdown content={content} />
      ) : (
        <PolicyEmpty note="The privacy policy hasn't been published yet." />
      )}
    </PolicyLayout>
  );
}

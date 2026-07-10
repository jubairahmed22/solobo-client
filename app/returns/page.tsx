import type { Metadata } from "next";
import { Markdown } from "@/components/composed";
import { PolicyLayout, PolicyEmpty } from "@/components/layout/PolicyLayout";
import { contentMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/siteSettings.server";
import { COMPANY } from "@/lib/entity/company";

export const revalidate = 300;

export const metadata: Metadata = contentMetadata({
  title: "Returns & Refunds",
  description: `How to return an item and get a refund from ${COMPANY.name}.`,
  path: "/returns",
});

export default async function ReturnsPage() {
  const settings = await getSiteSettings();
  const content = settings?.returnPolicy?.trim();

  return (
    <PolicyLayout title="Returns & Refunds">
      {content ? (
        <Markdown content={content} />
      ) : (
        <PolicyEmpty note="The return policy hasn't been published yet." />
      )}
    </PolicyLayout>
  );
}

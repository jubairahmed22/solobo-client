import type { Metadata } from "next";
import { Markdown } from "@/components/composed";
import { PolicyLayout, PolicyEmpty } from "@/components/layout/PolicyLayout";
import { contentMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/siteSettings.server";
import { COMPANY } from "@/lib/entity/company";

export const revalidate = 300;

export const metadata: Metadata = contentMetadata({
  title: "Shipping & Delivery",
  description: `Delivery areas, charges and timelines for ${COMPANY.name} orders.`,
  path: "/shipping",
});

export default async function ShippingPage() {
  const settings = await getSiteSettings();
  const content = settings?.shippingDetails?.trim();

  return (
    <PolicyLayout title="Shipping & Delivery">
      {content ? (
        <Markdown content={content} />
      ) : (
        <PolicyEmpty note="Shipping details haven't been published yet." />
      )}
    </PolicyLayout>
  );
}

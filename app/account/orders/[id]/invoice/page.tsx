import type { Metadata } from "next";
import { CustomerInvoiceClient } from "./CustomerInvoiceClient";

export const metadata: Metadata = {
  title: "Invoice",
  // The invoice URL is per-order and gated by auth at the API; index follow
  // would be useless and `noindex` makes that explicit for crawlers.
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { id: string };
}

/**
 * Customer-facing printable invoice. Re-uses the existing /api/orders/:id
 * payload (which the customer already has permission for) - there's no new
 * backend endpoint. The dedicated page exists so the print stylesheet can
 * strip surrounding chrome without affecting the regular order detail view.
 */
export default function CustomerInvoicePage({ params }: PageProps) {
  return <CustomerInvoiceClient orderId={params.id} />;
}

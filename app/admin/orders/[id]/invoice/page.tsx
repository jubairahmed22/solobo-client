import type { Metadata } from "next";
import { AdminInvoiceClient } from "./AdminInvoiceClient";

export const metadata: Metadata = {
  title: "Admin invoice",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { id: string };
}

/**
 * Admin invoice - full-fat order record. Re-uses /api/admin/orders/:id
 * (which already gates on admin/superadmin) and renders every line item
 * plus admin-only fields (internal notes). Useful for reconciliation
 * binders and customer-support disputes where a record showing every
 * field is more valuable than a clean customer-facing receipt.
 */
export default function AdminInvoicePage({ params }: PageProps) {
  return <AdminInvoiceClient orderId={params.id} />;
}

import type { Metadata } from "next";
import { OrderDetailClient } from "./OrderDetailClient";

export const metadata: Metadata = {
  title: "Order detail",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { id: string };
}

export default function OrderDetailPage({ params }: PageProps) {
  return <OrderDetailClient orderId={params.id} />;
}

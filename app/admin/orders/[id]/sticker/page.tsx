import type { Metadata } from "next";
import { OrderStickerClient } from "./OrderStickerClient";

export const metadata: Metadata = {
  title: "Shipping sticker",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { id: string };
}

/**
 * Compact courier shipping sticker - distinct from the full itemized
 * invoice at /admin/orders/:id/invoice. See OrderStickerClient.tsx for the
 * design/data-source notes.
 */
export default function OrderStickerPage({ params }: PageProps) {
  return <OrderStickerClient orderId={params.id} />;
}

import type { Metadata } from "next";
import { Navbar, Footer } from "@/components/layout";
import { OrderSuccessClient } from "./OrderSuccessClient";

export const metadata: Metadata = {
  title: "Order placed",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { id: string };
}

export default function OrderSuccessPage({ params }: PageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-3">
        <OrderSuccessClient orderId={params.id} />
      </main>
      <Footer />
    </div>
  );
}

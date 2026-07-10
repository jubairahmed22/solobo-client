import type { Metadata } from "next";
import { Navbar, Footer } from "@/components/layout";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="mx-auto w-full flex-1 px-2 py-4 sm:py-6 lg:w-[82%] lg:max-w-none lg:px-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Checkout</h1>
        <CheckoutClient />
      </main>
      <Footer />
    </div>
  );
}

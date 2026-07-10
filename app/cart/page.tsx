import type { Metadata } from "next";
import { Navbar, Footer } from "@/components/layout";
import { CartClient } from "./CartClient";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-ink">
      <Navbar />
      <main className="mx-auto w-full flex-1 px-2 py-4 sm:py-6 lg:w-[82%] lg:max-w-none lg:px-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Shopping Cart</h1>
        <CartClient />
      </main>
      <Footer />
    </div>
  );
}

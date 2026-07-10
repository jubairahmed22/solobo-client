import type { Metadata } from "next";
import { Navbar, Footer } from "@/components/layout";
import { WishlistClient } from "./WishlistClient";
import { COMPANY } from "@/lib/entity/company";

export const metadata: Metadata = {
  title: "Your wishlist",
  description: `Items you've saved for later on ${COMPANY.name}.`,
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-ink">
      <Navbar />
      <main className="mx-auto flex w-full flex-1 flex-col gap-4 px-2 py-4 sm:py-6 lg:w-[82%] lg:max-w-none lg:px-0">
        <WishlistClient />
      </main>
      <Footer />
    </div>
  );
}

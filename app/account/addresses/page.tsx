import type { Metadata } from "next";
import { AddressesClient } from "./AddressesClient";

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <section className="flex flex-col gap-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Address book</h1>
        <p className="text-sm text-neutral-600">
          Save addresses to make checkout one-tap fast. The default address is used unless
          you pick another at checkout.
        </p>
      </header>
      <AddressesClient />
    </section>
  );
}

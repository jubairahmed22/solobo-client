import type { Metadata } from "next";
import { OrdersListClient } from "./OrdersListClient";
import { COMPANY } from "@/lib/entity/company";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <section className="flex flex-col gap-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>
        <p className="text-sm text-neutral-600">Everything you&apos;ve bought on {COMPANY.name}.</p>
      </header>
      <OrdersListClient />
    </section>
  );
}

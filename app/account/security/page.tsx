import type { Metadata } from "next";
import { SecurityClient } from "./SecurityClient";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

export default function SecurityPage() {
  return (
    <section className="flex flex-col gap-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-neutral-600">
          Update your password. After changing, every other session is signed out.
        </p>
      </header>
      <SecurityClient />
    </section>
  );
}

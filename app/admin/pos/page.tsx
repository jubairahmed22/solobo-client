import * as React from "react";
import type { Metadata } from "next";
import { PosClient } from "./PosClient";

export const metadata: Metadata = {
  title: "POS · Admin",
  robots: { index: false, follow: false },
};

/**
 * Point-of-sale surface for in-person / phone-in sales. Cashier picks
 * products from the live catalog, captures either a walk-in or an
 * existing-account buyer, takes payment via any of the platform's
 * supported methods, and the resulting order lands already confirmed
 * (and "paid" for cash sales). After creation we redirect to the
 * admin invoice page so the cashier can print and hand it over.
 */
export default function AdminPosPage() {
  return <PosClient />;
}

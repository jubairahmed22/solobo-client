import type { Metadata } from "next";
import { CustomizationsClient } from "./CustomizationsClient";

export const metadata: Metadata = { title: "Customizations" };

export default function CustomizationsPage() {
  return <CustomizationsClient />;
}

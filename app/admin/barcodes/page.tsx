import { BarcodeHubClient } from "./BarcodeHubClient";
import { COMPANY } from "@/lib/entity/company";

export const metadata = {
  title: `Barcodes - ${COMPANY.name} Admin`,
};

export default function BarcodesPage() {
  return <BarcodeHubClient />;
}

import type { SiteSettingsDelivery } from "@/types/siteSettings";

/**
 * Districts billed at the "sub-Dhaka" delivery rate rather than the full
 * outside-Dhaka rate. Mirrors Server/src/utils/shipping.ts exactly - keep
 * both lists in sync. Free text on the address form, so this is a
 * lowercase, substring match rather than an exact one, and accepts both
 * common English transliterations of Narayanganj.
 */
const SUB_DHAKA_DISTRICTS = ["tongi", "narayanganj", "narayangonj", "savar"];

function districtTier(district: string | undefined): "inside" | "sub" | "outside" {
  const d = district?.trim().toLowerCase() ?? "";
  if (d === "dhaka") return "inside";
  if (SUB_DHAKA_DISTRICTS.some((sub) => d.includes(sub))) return "sub";
  return "outside";
}

/**
 * Client-side estimate of the flat delivery rate - mirrors the backend's
 * `resolveShipping` so the preview shown before submit matches what the
 * server will actually charge. Only an estimate: the server is always the
 * source of truth at checkout time.
 */
export function estimateShipping(
  district: string | undefined,
  subtotal: number,
  delivery?: Pick<SiteSettingsDelivery, "insideDhaka" | "subDhaka" | "outsideDhaka" | "freeShippingThreshold">,
): number {
  if (!district) return 0;
  const threshold = delivery?.freeShippingThreshold ?? 0;
  if (threshold > 0 && subtotal >= threshold) return 0;
  const tier = districtTier(district);
  if (tier === "inside") return delivery?.insideDhaka ?? 70;
  if (tier === "sub") return delivery?.subDhaka ?? 100;
  return delivery?.outsideDhaka ?? 130;
}

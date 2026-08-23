import type { CartAddOn } from "@/store/cartStore";
import type { PublicCustomizationConfig } from "@/types/customization";

/**
 * Reconstruct the customization cost breakdown for a cart line that only
 * persists the final unit price + the option strings the PDP wrote
 * ("Name", "Number", "Patches"). Prices the options against the current
 * public customization config. Best-effort: if a patch was renamed since
 * being added, it simply drops out of the breakdown.
 */
export function deriveAddOns(
  price: number,
  options: Record<string, string> | undefined,
  config: PublicCustomizationConfig | null | undefined,
): { basePrice?: number; addOns?: CartAddOn[] } {
  if (!config || !options) return {};
  const addOns: CartAddOn[] = [];
  const nameActive = Boolean(options["Name"]?.trim());
  const numberActive = Boolean(options["Number"]?.trim());
  if ((nameActive || numberActive) && config.addOnPrices.name > 0) {
    addOns.push({
      label:
        nameActive && numberActive
          ? "Name & number print"
          : nameActive
            ? "Name print"
            : "Number print",
      amount: config.addOnPrices.name,
    });
  }
  for (const patchName of (options["Patches"] ?? "").split(",").map((s) => s.trim())) {
    if (!patchName) continue;
    const patch = config.patches.find((p) => p.name === patchName);
    if (patch) addOns.push({ label: `Patch: ${patch.name}`, amount: patch.price });
  }
  if (addOns.length === 0) return {};
  const addOnTotal = addOns.reduce((s, a) => s + a.amount, 0);
  return { basePrice: Math.max(0, price - addOnTotal), addOns };
}

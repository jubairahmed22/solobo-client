import type { SelectOption } from "@/components/composed";
import type { CategoryTreeNode } from "@/types/catalog";

/**
 * Flatten a category tree into a single indented option list - "Clothing",
 * "Clothing › Men", "Clothing › Men › Shirts" - so one <select> can pick a
 * category at any depth (top-level, sub-category, or child category).
 * Shared by the product create/edit forms and the products list filter.
 */
export function flattenCategoryTree(nodes: CategoryTreeNode[], prefix = ""): SelectOption[] {
  const out: SelectOption[] = [];
  for (const node of nodes) {
    if (!node.isActive) continue;
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    out.push({ value: node._id, label });
    if (node.children?.length) out.push(...flattenCategoryTree(node.children, label));
  }
  return out;
}

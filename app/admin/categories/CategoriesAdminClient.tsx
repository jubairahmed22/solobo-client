"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Edit2,
  FolderTree,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminTreeSkeleton } from "@/components/admin/Skeleton";
import { cn } from "@/lib/utils/cn";
import { useAdminCategories } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminCategorySummary } from "@/types/admin";

/* ──────────────────────────────────────────────────────────
   Tree builder
   ────────────────────────────────────────────────────────── */

interface TreeNode extends AdminCategorySummary {
  children: TreeNode[];
}

function buildTree(flat: AdminCategorySummary[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const c of flat) map.set(c._id, { ...c, children: [] });

  const roots: TreeNode[] = [];
  for (const c of flat) {
    const node = map.get(c._id)!;
    const parentId = c.ancestors[c.ancestors.length - 1];
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const n of nodes) sort(n.children);
  };
  sort(roots);
  return roots;
}

/* ──────────────────────────────────────────────────────────
   Tree row (recursive)
   ────────────────────────────────────────────────────────── */

function CategoryTreeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node._id);

  return (
    <>
      <tr className="group border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50">
        {/* Name cell */}
        <td className="py-2 pr-2 align-middle" style={{ paddingLeft: `${8 + depth * 20}px` }}>
          <div className="flex items-center gap-1.5">
            {/* expand toggle */}
            <button
              type="button"
              onClick={() => hasChildren && onToggle(node._id)}
              className={cn(
                "flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] text-gray-400 transition-colors",
                hasChildren
                  ? "hover:bg-gray-100 hover:text-gray-900"
                  : "cursor-default opacity-0",
              )}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={cn(
                  "h-[16px] w-[16px] transition-transform duration-150",
                  isExpanded && "rotate-90",
                )}
                aria-hidden
              />
            </button>

            {/* thumbnail */}
            <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-gray-200 bg-gray-50 text-gray-400">
              {node.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={node.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <FolderTree className="h-[16px] w-[16px]" aria-hidden />
              )}
            </span>

            {/* name + path */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-[6px]">
                <Link
                  href={`/admin/categories/${node._id}`}
                  className="min-w-0 truncate text-[14px] font-medium text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline"
                >
                  {node.name}
                </Link>
                {/* Status column is hidden on phones - flag hidden ones inline */}
                {!node.isActive ? (
                  <span className="shrink-0 rounded-[4px] bg-gray-100 px-[6px] py-[1px] text-[10px] font-medium text-gray-800 sm:hidden">
                    Hidden
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[11px] text-gray-400">/{node.path}</p>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="hidden py-2 px-2 align-middle sm:table-cell">
          <span
            className={cn(
              "inline-flex items-center rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium",
              node.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800",
            )}
          >
            {node.isActive ? "Active" : "Hidden"}
          </span>
        </td>

        {/* Child count */}
        <td className="hidden py-2 px-2 align-middle text-[11px] tabular-nums text-neutral-400 lg:table-cell">
          {hasChildren ? `${node.children.length} sub` : "-"}
        </td>

        {/* Actions (appear on row hover) */}
        <td className="py-2 pl-2 pr-3 align-middle">
          <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <Link
              href={`/admin/categories/new?parent=${node._id}`}
              title="Add subcategory"
              className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-[#1A56DB]"
            >
              <Plus className="h-[16px] w-[16px]" aria-hidden />
            </Link>
            <Link
              href={`/admin/categories/${node._id}`}
              title="Edit"
              className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <Edit2 className="h-[16px] w-[16px]" aria-hidden />
            </Link>
          </div>
        </td>
      </tr>

      {/* Children (only when expanded) */}
      {isExpanded &&
        node.children.map((child) => (
          <CategoryTreeRow
            key={child._id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   Flat row (used when search/filter is active)
   ────────────────────────────────────────────────────────── */

function FlatCategoryRow({ category }: { category: AdminCategorySummary }) {
  return (
    <tr className="group border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50">
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center gap-2">
          <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-gray-200 bg-gray-50 text-gray-400">
            {category.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.image}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <FolderTree className="h-[16px] w-[16px]" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[6px]">
              <Link
                href={`/admin/categories/${category._id}`}
                className="min-w-0 truncate text-[14px] font-medium text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline"
              >
                {category.name}
              </Link>
              {!category.isActive ? (
                <span className="shrink-0 rounded-[4px] bg-gray-100 px-[6px] py-[1px] text-[10px] font-medium text-gray-800 sm:hidden">
                  Hidden
                </span>
              ) : null}
            </div>
            <p className="truncate text-[11px] text-gray-400">/{category.path}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-2 py-2 align-middle sm:table-cell">
        <span
          className={cn(
            "inline-flex items-center rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium",
            category.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800",
          )}
        >
          {category.isActive ? "Active" : "Hidden"}
        </span>
      </td>
      <td className="px-2 py-2 align-middle">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/admin/categories/new?parent=${category._id}`}
            title="Add subcategory"
            className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-[#1A56DB]"
          >
            <Plus className="h-[16px] w-[16px]" aria-hidden />
          </Link>
          <Link
            href={`/admin/categories/${category._id}`}
            title="Edit"
            className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-400 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
          >
            <Edit2 className="h-[16px] w-[16px]" aria-hidden />
          </Link>
        </div>
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────── */

export function CategoriesAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const qFromUrl = search.get("q") ?? "";
  const statusFilter = (search.get("status") ?? "all") as "all" | "active" | "inactive";
  const isFiltering = Boolean(qFromUrl) || statusFilter !== "all";

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => { setQDraft(qFromUrl); }, [qFromUrl]);

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k); else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { data, isLoading, isError, error, refetch } = useAdminCategories({
    shape: "flat",
    isActive:
      statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
    search: qFromUrl || undefined,
    limit: 300,
  });

  const flat = data?.data ?? [];
  const tree = React.useMemo(() => buildTree(flat), [flat]);

  // Auto-expand all top-level nodes on first load
  React.useEffect(() => {
    if (tree.length > 0 && expanded.size === 0) {
      setExpanded(new Set(tree.map((n) => n._id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

  const onToggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const expandAll = () => setExpanded(new Set(flat.map((c) => c._id)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[20px] font-bold leading-tight text-gray-900 sm:text-[24px]">Categories</h1>
          <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">
            {data
              ? `${data.meta?.total ?? 0} categories in the catalog taxonomy.`
              : "Browse and manage the catalog taxonomy."}
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          {/* Flowbite primary button */}
          <Link
            href="/admin/categories/new"
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            <Plus className="h-[16px] w-[16px]" aria-hidden /> New category
          </Link>
        </div>
      </header>

      {/* Status tabs - Flowbite underline tabs */}
      <AdminTabs
        ariaLabel="Category status filter"
        items={[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Hidden" },
        ]}
        value={statusFilter}
        onChange={(v) => update({ status: v === "all" ? undefined : v })}
      />

      {/* Filter bar - Flowbite table toolbar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: qDraft.trim() || undefined });
          }}
          className="flex w-full min-w-0 flex-1 items-center gap-[8px]"
        >
          <label htmlFor="categories-search" className="sr-only">Search categories</label>
          <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input
              id="categories-search"
              type="search"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search categories…"
              className="pl-[36px]"
            />
          </div>
          <button
            type="submit"
            className="h-[40px] shrink-0 rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            Find
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-[12px] lg:ml-auto lg:shrink-0 lg:justify-end">
          {/* Expand / collapse */}
          {!isFiltering && flat.length > 0 ? (
            <div className="flex items-center gap-[4px] text-[13px] font-medium text-gray-500">
              <button
                type="button"
                onClick={expandAll}
                className="underline-offset-2 transition duration-75 hover:text-[#1A56DB] hover:underline"
              >
                Expand all
              </button>
              <span className="text-gray-300">/</span>
              <button
                type="button"
                onClick={collapseAll}
                className="underline-offset-2 transition duration-75 hover:text-[#1A56DB] hover:underline"
              >
                Collapse
              </button>
            </div>
          ) : null}

          {isFiltering ? (
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="inline-flex h-[40px] items-center gap-[6px] rounded-[8px] border border-gray-200 bg-white px-[12px] text-[13px] font-medium text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-[14px] w-[14px]" aria-hidden /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <AdminTreeSkeleton rows={9} />
      ) : isError ? (
        <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
          <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
          <p className="text-[14px] text-gray-500">
            {error instanceof AdminError ? error.message : "Couldn't load categories."}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : flat.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[56px] text-center">
          <FolderTree className="h-[32px] w-[32px] text-gray-300" aria-hidden />
          <p className="text-[14px] font-medium text-gray-600">
            {isFiltering ? "No categories match these filters." : "No categories yet."}
          </p>
          {!isFiltering ? (
            <Link
              href="/admin/categories/new"
              className="text-[13px] font-medium text-[#1A56DB] underline-offset-2 hover:underline"
            >
              Create your first category →
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Category
                </th>
                <th className="hidden px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 sm:table-cell">
                  Status
                </th>
                <th className="hidden px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 lg:table-cell">
                  Children
                </th>
                <th className="px-2 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {isFiltering
                ? flat.map((c) => <FlatCategoryRow key={c._id} category={c} />)
                : tree.map((node) => (
                    <CategoryTreeRow
                      key={node._id}
                      node={node}
                      depth={0}
                      expanded={expanded}
                      onToggle={onToggle}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
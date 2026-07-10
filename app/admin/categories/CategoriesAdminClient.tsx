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
import { Button, Input, Spinner } from "@/components/ui";
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
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-neutral-400 transition-colors",
                hasChildren
                  ? "hover:bg-neutral-100 hover:text-ink"
                  : "cursor-default opacity-0",
              )}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-150",
                  isExpanded && "rotate-90",
                )}
                aria-hidden
              />
            </button>

            {/* thumbnail */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-400">
              {node.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={node.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <FolderTree className="h-3 w-3" aria-hidden />
              )}
            </span>

            {/* name + path */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/categories/${node._id}`}
                className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
              >
                {node.name}
              </Link>
              <p className="truncate text-[11px] text-neutral-400">/{node.path}</p>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="hidden py-2 px-2 align-middle sm:table-cell">
          <span
            className={cn(
              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
              node.isActive
                ? "bg-accent/20 text-ink"
                : "bg-neutral-100 text-neutral-500",
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
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Link
              href={`/admin/categories/new?parent=${node._id}`}
              title="Add subcategory"
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-accent/20 hover:text-ink"
            >
              <Plus className="h-3 w-3" aria-hidden />
            </Link>
            <Link
              href={`/admin/categories/${node._id}`}
              title="Edit"
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-ink"
            >
              <Edit2 className="h-3 w-3" aria-hidden />
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
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-400">
            {category.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.image}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <FolderTree className="h-3 w-3" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/categories/${category._id}`}
              className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
            >
              {category.name}
            </Link>
            <p className="truncate text-[11px] text-neutral-400">/{category.path}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-2 py-2 align-middle sm:table-cell">
        <span
          className={cn(
            "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
            category.isActive
              ? "bg-accent/20 text-ink"
              : "bg-neutral-100 text-neutral-500",
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
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-accent/20 hover:text-ink"
          >
            <Plus className="h-3 w-3" aria-hidden />
          </Link>
          <Link
            href={`/admin/categories/${category._id}`}
            title="Edit"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-ink"
          >
            <Edit2 className="h-3 w-3" aria-hidden />
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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Categories</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {data
              ? `${data.meta?.total ?? 0} categories · hover a row to add a subcategory`
              : "Browse and manage the catalog taxonomy."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/categories/new"
            className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" aria-hidden /> New category
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: qDraft.trim() || undefined });
          }}
          className="flex min-w-[200px] flex-1 items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input
              type="search"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search categories…"
              className="pl-8"
            />
          </div>
          <button
            type="submit"
            className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink"
          >
            Find
          </button>
        </form>

        <div className="h-5 w-px bg-neutral-200" />

        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-neutral-400">Status</span>
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update({ status: s === "all" ? undefined : s })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-ink bg-ink text-paper"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-ink",
              )}
            >
              {s === "all" ? "All" : s === "active" ? "Active" : "Hidden"}
            </button>
          ))}
        </div>

        {/* Expand / collapse */}
        {!isFiltering && flat.length > 0 ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              <button
                type="button"
                onClick={expandAll}
                className="underline-offset-2 hover:text-ink hover:underline"
              >
                Expand all
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={collapseAll}
                className="underline-offset-2 hover:text-ink hover:underline"
              >
                Collapse
              </button>
            </div>
          </>
        ) : null}

        {isFiltering ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink"
            >
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          </>
        ) : null}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">
            {error instanceof AdminError ? error.message : "Couldn't load categories."}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : flat.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <FolderTree className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">
            {isFiltering ? "No categories match these filters." : "No categories yet."}
          </p>
          {!isFiltering ? (
            <Link
              href="/admin/categories/new"
              className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-ink hover:underline"
            >
              Create your first category →
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-paper">
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
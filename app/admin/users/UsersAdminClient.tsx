"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Search, ShieldOff, Users, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useAdminUsers } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminListUsersParams, AdminUserRole, AdminUserRoleFilter, AdminUserSort, AdminUserStatus, AdminUserSummary } from "@/types/admin";

const ROLE_FILTERS: { value: AdminUserRoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "Customers" },
  { value: "admin", label: "Admins" },
  { value: "superadmin", label: "Superadmins" },
];

const STATUS_FILTERS: { value: AdminUserStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const SORT_OPTIONS: { value: AdminUserSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

function roleLabel(role: AdminUserRole): string {
  switch (role) {
    case "admin": return "Admin";
    case "superadmin": return "Superadmin";
    case "user": default: return "Customer";
  }
}

function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return (
    <div aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
      {letters || "?"}
    </div>
  );
}

function UserRow({ user }: { user: AdminUserSummary }) {
  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2.5">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" />
          ) : (
            <Initials name={user.name} />
          )}
          <div className="min-w-0 flex-1">
            <Link href={`/admin/users/${user._id}`} className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline">
              {user.name}
            </Link>
            <p className="truncate text-xs text-neutral-500">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className={cn(
          "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
          user.role === "superadmin" ? "border border-ink bg-paper text-ink"
          : user.role === "admin" ? "bg-ink text-paper"
          : "bg-neutral-100 text-neutral-600",
        )}>
          {roleLabel(user.role)}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
            user.isSuspended ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700",
          )}>
            {user.isSuspended
              ? <><ShieldOff className="h-3 w-3" aria-hidden /> Suspended</>
              : <><CheckCircle2 className="h-3 w-3" aria-hidden /> Active</>}
          </span>
          {!user.emailVerified ? <span className="text-[10px] text-neutral-500">Unverified email</span> : null}
        </div>
      </td>
      <td className="hidden px-3 py-2.5 align-middle text-xs text-neutral-500 md:table-cell">{formatDate(user.createdAt)}</td>
      <td className="px-3 py-2.5 align-middle text-right">
        <Link href={`/admin/users/${user._id}`} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink">
          Manage <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

export function UsersAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const role = (search.get("role") ?? "all") as AdminUserRoleFilter;
  const status = (search.get("status") ?? "all") as AdminUserStatus;
  const sort = (search.get("sort") ?? "newest") as AdminUserSort;
  const qFromUrl = search.get("q") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => { setQDraft(qFromUrl); }, [qFromUrl]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k); else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmitSearch = (e: React.FormEvent) => { e.preventDefault(); update({ q: qDraft.trim() || undefined }); };

  const params: AdminListUsersParams = React.useMemo(
    () => ({ role: role !== "all" ? role : undefined, status: status !== "all" ? status : undefined, sort, q: qFromUrl || undefined, page, limit: 20 }),
    [role, status, sort, qFromUrl, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminUsers(params);
  const users = data?.data.users ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = role !== "all" || status !== "all" || Boolean(qFromUrl) || sort !== "newest";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Users</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Promote moderators, suspend abusive accounts, or look up a customer&apos;s history.</p>
        </div>
        {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
      </header>

      {/* Role chips */}
      <nav aria-label="Role filter" className="flex flex-wrap gap-1.5">
        {ROLE_FILTERS.map((f) => {
          const active = role === f.value;
          return (
            <button key={f.value} type="button" onClick={() => update({ role: f.value === "all" ? undefined : f.value })}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-ink bg-ink text-paper" : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-ink")}
              aria-pressed={active}>
              {f.label}
            </button>
          );
        })}
      </nav>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Name, email, or phone" className="pl-8" />
          </div>
          <button type="submit" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Find</button>
        </form>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Status</span>
          <Select value={status} onChange={(e) => update({ status: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Sort</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value })} options={SORT_OPTIONS} />
        </div>
        {filtersActive ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink">
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          </>
        ) : null}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load users."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <Users className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">No users match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">User</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Role</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="hidden px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 md:table-cell">Joined</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => <UserRow key={u._id} user={u} />)}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}

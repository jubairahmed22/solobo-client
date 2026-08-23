"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Search, ShieldOff, Users, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminListSkeleton } from "@/components/admin/Skeleton";
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

const ROLE_TONES: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  user: "bg-gray-100 text-gray-800",
};

function Avatar({ user, size = 40 }: { user: AdminUserSummary; size?: number }) {
  if (user.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  const letters = user.name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-[13px] font-semibold text-gray-700"
    >
      {letters || "?"}
    </div>
  );
}

function RoleBadge({ role }: { role: AdminUserRole }) {
  return (
    <span className={cn("inline-flex items-center rounded-[4px] px-[8px] py-[2px] text-[11px] font-medium", ROLE_TONES[role] ?? "bg-gray-100 text-gray-800")}>
      {roleLabel(role)}
    </span>
  );
}

function StatusBadge({ suspended }: { suspended: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-[4px] rounded-[4px] px-[8px] py-[2px] text-[11px] font-medium",
      suspended ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800",
    )}>
      {suspended
        ? <><ShieldOff className="h-[12px] w-[12px]" aria-hidden /> Suspended</>
        : <><CheckCircle2 className="h-[12px] w-[12px]" aria-hidden /> Active</>}
    </span>
  );
}

/* Desktop table row */
function UserRow({ user }: { user: AdminUserSummary }) {
  return (
    <tr className="bg-white transition duration-75 hover:bg-gray-50">
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex items-center gap-[12px]">
          <Avatar user={user} />
          <div className="min-w-0 flex-1">
            <Link href={`/admin/users/${user._id}`} className="block truncate text-[14px] font-semibold text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline">
              {user.name}
            </Link>
            <p className="truncate text-[12px] text-gray-500">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-[16px] py-[12px] align-middle"><RoleBadge role={user.role} /></td>
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex flex-col gap-[2px]">
          <StatusBadge suspended={user.isSuspended} />
          {!user.emailVerified ? <span className="text-[11px] text-gray-400">Unverified email</span> : null}
        </div>
      </td>
      <td className="hidden px-[16px] py-[12px] align-middle text-[13px] text-gray-500 lg:table-cell">{formatDate(user.createdAt)}</td>
      <td className="px-[16px] py-[12px] align-middle text-right">
        <Link href={`/admin/users/${user._id}`} className="inline-flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium text-[#1A56DB] transition duration-75 hover:bg-gray-100 hover:underline">
          Manage <ArrowRight className="h-[16px] w-[16px]" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

/* Mobile card - native-app list cell, whole row taps through */
function UserCardMobile({ user }: { user: AdminUserSummary }) {
  return (
    <Link href={`/admin/users/${user._id}`} className="flex items-center gap-[12px] px-[16px] py-[12px] active:bg-gray-50">
      <Avatar user={user} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-gray-900">{user.name}</p>
        <p className="truncate text-[12px] text-gray-500">{user.email}</p>
        <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
          <RoleBadge role={user.role} />
          <StatusBadge suspended={user.isSuspended} />
          {!user.emailVerified ? <span className="text-[11px] text-gray-400">Unverified</span> : null}
        </div>
      </div>
      <ChevronRight className="h-[16px] w-[16px] shrink-0 text-gray-300" aria-hidden />
    </Link>
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
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[20px] font-bold leading-tight text-gray-900 sm:text-[24px]">Users</h1>
          <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">Promote moderators, suspend abusive accounts, or look up a customer&apos;s history.</p>
        </div>
        {meta ? <span className="text-[13px] text-gray-500 sm:text-[14px]">{meta.total.toLocaleString("en-US")} total</span> : null}
      </header>

      {/* Role tabs - Flowbite underline tabs */}
      <AdminTabs
        ariaLabel="Role filter"
        items={ROLE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        value={role}
        onChange={(v) => update({ role: v === "all" ? undefined : v })}
      />

      {/* Filter bar - Flowbite table toolbar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        <form onSubmit={onSubmitSearch} className="flex w-full min-w-0 flex-1 items-center gap-[8px]">
          <label htmlFor="users-search" className="sr-only">Search users</label>
          <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input id="users-search" type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Name, email, or phone" className="pl-[36px]" />
          </div>
          <button
            type="submit"
            className="h-[40px] shrink-0 rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            Find
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-[12px] lg:ml-auto lg:shrink-0 lg:justify-end">
          <div className="flex items-center gap-[8px]">
            <label htmlFor="users-status" className="text-[13px] font-medium text-gray-500">Status</label>
            <Select id="users-status" value={status} onChange={(e) => update({ status: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="users-sort" className="text-[13px] font-medium text-gray-500">Sort</label>
            <Select id="users-sort" value={sort} onChange={(e) => update({ sort: e.target.value })} options={SORT_OPTIONS} />
          </div>
          {filtersActive ? (
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

      {/* Results */}
      {isLoading ? (
        <AdminListSkeleton rows={8} columns={3} withThumb roundThumb />
      ) : isError ? (
        <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
          <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
          <p className="text-[14px] text-gray-500">{error instanceof AdminError ? error.message : "Couldn't load users."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[56px] text-center">
          <Users className="h-[32px] w-[32px] text-gray-300" aria-hidden />
          <p className="text-[14px] font-medium text-gray-600">No users match these filters.</p>
        </div>
      ) : (
        <>
          {/* Mobile - native-app card list */}
          <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-gray-100">
              {users.map((u) => (
                <li key={u._id}>
                  <UserCardMobile user={u} />
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop / tablet - full table */}
          <div className="hidden overflow-x-auto rounded-[8px] border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">User</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Role</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                  <th className="hidden px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 lg:table-cell">Joined</th>
                  <th className="px-3 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((u) => <UserRow key={u._id} user={u} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}

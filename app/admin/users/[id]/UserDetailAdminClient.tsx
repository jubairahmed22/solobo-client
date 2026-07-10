"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck, ShieldOff, Sparkles } from "lucide-react";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/store/uiStore";
import { useAdminUser, useSetUserStatus, useUpdateUserRole } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminAssignableRole, AdminUserDetail, AdminUserRecentOrder } from "@/types/admin";

function formatMoney(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-US")}`; }
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return (
    <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl font-semibold text-neutral-700">
      {letters || "?"}
    </div>
  );
}

function roleLabel(role: AdminUserDetail["role"]): string {
  switch (role) {
    case "admin": return "Admin";
    case "superadmin": return "Superadmin";
    case "user": default: return "Customer";
  }
}

/* "" Page "" */

export function UserDetailAdminClient({ id }: { id: string }) {
  const { data: user, isLoading, isError, error, refetch } = useAdminUser(id);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>;
  }

  if (isError || !user) {
    const message = error instanceof AdminError ? error.message : "Couldn't load user.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          <Link href="/admin/users" className="text-sm text-neutral-600 underline-offset-2 hover:underline">Back to users</Link>
        </div>
      </div>
    );
  }

  return <UserDetailPanels user={user} />;
}

/* "" Detail panels "" */

function UserDetailPanels({ user }: { user: AdminUserDetail }) {
  const me = useAuth().user;
  const isSelf = me?.id === user._id;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to users
        </Link>
      </header>

      <ProfileCard user={user} isSelf={isSelf} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <RecentOrdersCard orders={user.recentOrders} />
        </div>
        <aside className="flex flex-col gap-5">
          <RolePanel key={`role-${user._id}`} user={user} isSelf={isSelf} />
          <StatusPanel key={`status-${user._id}`} user={user} isSelf={isSelf} />
        </aside>
      </div>
    </div>
  );
}

/* "" Profile card "" */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-neutral-100 bg-neutral-50 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="text-base font-semibold text-ink">{value}</span>
    </div>
  );
}

function ProfileCard({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  return (
    <section className="flex flex-col gap-5 rounded-sm border border-neutral-200 bg-paper p-3">
      <div className="flex flex-wrap items-start gap-4">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <Initials name={user.name} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">{user.name}</h1>
            {isSelf ? <Badge variant="outline">You</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-neutral-400" aria-hidden /> {user.email}
              {user.emailVerified ? (
                <Badge variant="muted" className="ml-1">Verified</Badge>
              ) : (
                <Badge variant="outline" className="ml-1">Unverified</Badge>
              )}
            </span>
            {user.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-neutral-400" aria-hidden /> {user.phone}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>Joined {formatDate(user.createdAt)}</span>
            <span>·</span>
            <span>{user.providers.join(", ") || "local"} sign-in</span>
            <span>·</span>
            <span>{user.addressCount} saved addresses</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders" value={user.stats.orderCount.toLocaleString("en-US")} />
        <Stat label="Lifetime spend" value={formatMoney(user.stats.lifetimeSpend, "BDT")} />
        <Stat label="Coins" value={user.coins.toLocaleString("en-US")} />
        <Stat label="Role" value={roleLabel(user.role)} />
      </div>
    </section>
  );
}

/* "" Role panel "" */

const ROLE_OPTIONS: { value: AdminAssignableRole; label: string }[] = [
  { value: "user",  label: "Customer" },
  { value: "admin", label: "Admin" },
];

function RolePanel({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  const me = useAuth().user;
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateUserRole(user._id);
  const [draft, setDraft] = React.useState<AdminAssignableRole>(user.role === "admin" ? "admin" : "user");

  const targetIsSuperadmin = user.role === "superadmin";
  const callerCanModify = !isSelf && (!targetIsSuperadmin || me?.role === "superadmin");

  if (targetIsSuperadmin) {
    return (
      <section className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3">
        <h2 className="text-sm font-semibold text-ink">Role</h2>
        <Badge variant="outline">Superadmin (managed via DB)</Badge>
        <p className="text-xs text-neutral-500">Superadmin promotion/demotion is reserved for a deliberate database operation, not a runtime click.</p>
      </section>
    );
  }

  const dirty = draft !== user.role;

  const onSave = async () => {
    try {
      await update.mutateAsync({ role: draft });
      toast({ title: draft === "admin" ? "Promoted to admin" : "Demoted to customer", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't change role", tone: "error" }); }
  };

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="text-sm font-semibold text-ink">Role</h2>
      <Select value={draft} onChange={(e) => setDraft(e.target.value as AdminAssignableRole)} options={ROLE_OPTIONS} disabled={!callerCanModify} />
      <p className="text-xs text-neutral-500">
        {isSelf
          ? "You can't change your own role — ask another admin or a superadmin."
          : draft === "admin"
            ? "Admins can moderate orders, products, reviews, and other users."
            : "Customers only see their own account."}
      </p>
      <Button size="sm" onClick={onSave} disabled={!dirty || !callerCanModify || update.isPending}>
        <ShieldCheck className="h-4 w-4" aria-hidden />
        <span className="ml-1">{update.isPending ? "Saving..." : "Save role"}</span>
      </Button>
    </section>
  );
}

/* "" Status panel "" */

function StatusPanel({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  const me = useAuth().user;
  const toast = useUIStore((s) => s.toast);
  const setStatus = useSetUserStatus(user._id);
  const [reason, setReason] = React.useState("");

  const targetIsSuperadmin = user.role === "superadmin";
  const callerCanModify = !isSelf && (!targetIsSuperadmin || me?.role === "superadmin");

  const onSuspend = async () => {
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Suspensions need a note for the next reviewer.", tone: "error" });
      return;
    }
    try {
      await setStatus.mutateAsync({ isSuspended: true, reason: reason.trim() });
      toast({ title: "Account suspended", tone: "success" });
      setReason("");
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't suspend", tone: "error" }); }
  };

  const onReactivate = async () => {
    try {
      await setStatus.mutateAsync({ isSuspended: false });
      toast({ title: "Account reactivated", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't reactivate", tone: "error" }); }
  };

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Status</h2>
        <Badge variant={user.isSuspended ? "outline" : "solid"} className="gap-1">
          {user.isSuspended ? <><ShieldOff className="h-3 w-3" aria-hidden /> Suspended</> : <><CheckCircle2 className="h-3 w-3" aria-hidden /> Active</>}
        </Badge>
      </div>

      {user.isSuspended ? (
        <>
          <div className="flex flex-col gap-2 text-sm text-neutral-600">
            {user.suspendedAt ? <span>Suspended {formatDate(user.suspendedAt)}</span> : null}
            {user.suspendedReason ? (
              <span className="rounded-sm border border-neutral-200 p-3 text-neutral-700">{user.suspendedReason}</span>
            ) : null}
          </div>
          <Button size="sm" onClick={onReactivate} disabled={!callerCanModify || setStatus.isPending}>
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="ml-1">{setStatus.isPending ? "Reactivating..." : "Reactivate"}</span>
          </Button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Reason</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being suspended?" disabled={!callerCanModify} maxLength={500} />
          </label>
          <Button variant="secondary" size="sm" onClick={onSuspend} disabled={!callerCanModify || setStatus.isPending}>
            <ShieldOff className="h-4 w-4" aria-hidden />
            <span className="ml-1">{setStatus.isPending ? "Suspending..." : "Suspend account"}</span>
          </Button>
        </>
      )}

      <p className="text-xs text-neutral-500">
        {isSelf
          ? "You can't change your own status."
          : "Suspending clears all sessions on the next access-token refresh (~15 min). Active orders are unaffected."}
      </p>
    </section>
  );
}

/* "" Recent orders "" */

function RecentOrdersCard({ orders }: { orders: AdminUserRecentOrder[] }) {
  if (orders.length === 0) {
    return (
      <section className="rounded-sm border border-neutral-200 bg-paper p-3">
        <h2 className="text-sm font-semibold text-ink">Recent orders</h2>
        <p className="mt-1 text-sm text-neutral-500">This customer hasn't placed an order yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="mb-4 text-sm font-semibold text-ink">Recent orders</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Order</th>
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Total</th>
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Placed</th>
              <th className="pb-3" aria-label="Open" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((o) => (
              <tr key={o._id} className="transition-colors hover:bg-neutral-50">
                <td className="py-3 pr-4 align-middle font-mono text-sm text-ink">{o.orderNumber}</td>
                <td className="py-3 pr-4 align-middle tabular-nums">{formatMoney(o.total, o.currency)}</td>
                <td className="py-3 pr-4 align-middle">
                  <Badge variant={o.status === "cancelled" || o.status === "returned" ? "outline" : "muted"}>{o.status}</Badge>
                </td>
                <td className="py-3 pr-4 align-middle text-xs text-neutral-500">{formatDate(o.createdAt)}</td>
                <td className="py-3 align-middle text-right">
                  <Link href={`/admin/orders/${o._id}`} className={cn("inline-flex items-center text-xs font-medium text-neutral-600 underline-offset-2 hover:text-ink hover:underline")}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}



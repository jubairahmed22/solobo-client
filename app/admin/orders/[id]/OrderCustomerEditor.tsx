"use client";

import * as React from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Save,
  StickyNote,
  User,
} from "lucide-react";
import { Avatar, Button, Input } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";
import { usePatchAdminOrderCustomer } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminOrderDetail, AdminPatchOrderCustomerInput } from "@/types/admin";
import type { Address, AddressInput } from "@/types/commerce";

/* ───────────────────── Helpers ───────────────────── */

/**
 * Project the (possibly partial) Address object back into the form-shape
 * `AddressInput` the patch endpoint accepts. Empty strings stand in for
 * missing optional fields so the form has stable controlled inputs.
 */
function addressToInput(addr: Address | undefined): AddressInput {
  return {
    fullName: addr?.fullName ?? "",
    phone: addr?.phone ?? "",
    altPhone: addr?.altPhone ?? "",
    line1: addr?.line1 ?? "",
    line2: addr?.line2 ?? "",
    city: addr?.city ?? "",
    district: addr?.district ?? "",
    division: addr?.division ?? "",
    postalCode: addr?.postalCode ?? "",
    country: addr?.country ?? "BD",
    label: addr?.label,
    isDefault: addr?.isDefault,
  };
}

/**
 * Trim every string field on a form-state `AddressInput` so the diff
 * check below isn't fooled by trailing whitespace the cashier left
 * behind while typing.
 */
function normaliseAddress(a: AddressInput): AddressInput {
  return {
    fullName: a.fullName.trim(),
    phone: a.phone.trim(),
    altPhone: a.altPhone?.trim() || undefined,
    line1: a.line1.trim(),
    line2: a.line2?.trim() || undefined,
    city: a.city.trim(),
    district: a.district.trim(),
    division: a.division?.trim() || undefined,
    postalCode: a.postalCode?.trim() || undefined,
    country: a.country?.trim() || "BD",
    label: a.label,
    isDefault: a.isDefault,
  };
}

/** Build a partial patch with only the address keys that changed. */
function diffAddress(
  next: AddressInput,
  prev: AddressInput,
): Partial<AddressInput> {
  const out: Partial<AddressInput> = {};
  const keys: Array<keyof AddressInput> = [
    "fullName",
    "phone",
    "altPhone",
    "line1",
    "line2",
    "city",
    "district",
    "division",
    "postalCode",
    "country",
  ];
  for (const k of keys) {
    if ((next[k] ?? undefined) !== (prev[k] ?? undefined)) {
      // Use undefined to clear, otherwise the trimmed value.
      out[k] = next[k] as never;
    }
  }
  return out;
}

/* ───────────────────── Customer editor card ───────────────────── */

export interface OrderCustomerEditorProps {
  order: AdminOrderDetail;
}

export function OrderCustomerEditor({ order }: OrderCustomerEditorProps) {
  const toast = useUIStore((s) => s.toast);
  const patch = usePatchAdminOrderCustomer(order._id);

  // We pull everything we can edit into local form state. Whenever a
  // refetch lands with a different version of the order, we reset the
  // form so the cashier doesn't end up editing against stale defaults.
  const [email, setEmail] = React.useState(order.email ?? "");
  const [customerNote, setCustomerNote] = React.useState(order.customerNote ?? "");
  const [internalNotes, setInternalNotes] = React.useState(order.internalNotes ?? "");
  const [address, setAddress] = React.useState<AddressInput>(
    addressToInput(order.shippingAddress),
  );

  React.useEffect(() => {
    setEmail(order.email ?? "");
    setCustomerNote(order.customerNote ?? "");
    setInternalNotes(order.internalNotes ?? "");
    setAddress(addressToInput(order.shippingAddress));
  }, [
    order.email,
    order.customerNote,
    order.internalNotes,
    order.shippingAddress,
  ]);

  const upd = (k: keyof AddressInput) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setAddress((s) => ({ ...s, [k]: e.target.value }));

  const original = React.useMemo(
    () => ({
      email: order.email ?? "",
      customerNote: order.customerNote ?? "",
      internalNotes: order.internalNotes ?? "",
      address: addressToInput(order.shippingAddress),
    }),
    [order.email, order.customerNote, order.internalNotes, order.shippingAddress],
  );

  const trimmedEmail = email.trim();
  const trimmedCustomerNote = customerNote.trim();
  const trimmedInternalNotes = internalNotes.trim();
  const normalisedAddress = normaliseAddress(address);
  const addressDiff = diffAddress(normalisedAddress, addressToInput(order.shippingAddress));

  const dirty =
    trimmedEmail !== original.email ||
    trimmedCustomerNote !== original.customerNote ||
    trimmedInternalNotes !== original.internalNotes ||
    Object.keys(addressDiff).length > 0;

  const onSave = async () => {
    const body: AdminPatchOrderCustomerInput = {};
    if (trimmedEmail !== original.email) {
      body.email = trimmedEmail || undefined;
    }
    if (trimmedCustomerNote !== original.customerNote) {
      body.customerNote = trimmedCustomerNote || undefined;
    }
    if (trimmedInternalNotes !== original.internalNotes) {
      body.internalNotes = trimmedInternalNotes || undefined;
    }
    if (Object.keys(addressDiff).length > 0) {
      body.shippingAddress = addressDiff;
    }
    try {
      await patch.mutateAsync(body);
      toast({ title: "Customer details updated", tone: "success" });
    } catch (err) {
      const message =
        err instanceof AdminError ? err.message : "Couldn't save changes";
      toast({ title: message, tone: "error" });
    }
  };

  const onReset = () => {
    setEmail(original.email);
    setCustomerNote(original.customerNote);
    setInternalNotes(original.internalNotes);
    setAddress(original.address);
  };

  const customer = order.user;

  return (
    <section className="rounded-md border border-neutral-200 bg-paper p-1.5">
      <header className="mb-1 flex items-center gap-0.5">
        <h2 className="flex items-center gap-0.5 text-base font-semibold text-ink">
          <User className="h-2 w-2" aria-hidden /> Customer
        </h2>
      </header>

      {/* Account block - name comes from the linked user record (if any) and
          isn't editable here; admins manage that on the user detail page. */}
      <div className="flex items-start gap-1">
        <Avatar
          src={undefined}
          alt={customer?.name ?? order.email ?? "Guest"}
          size={32}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink truncate">
            {customer?.name ?? "Guest"}
          </div>
          <div className="text-xs text-neutral-600 truncate">
            Account email: {customer?.email ?? "-"}
          </div>
          {customer?.phone ? (
            <div className="flex items-center gap-0.5 text-xs text-neutral-600">
              <Phone className="h-2 w-2" aria-hidden /> {customer.phone}
            </div>
          ) : null}
        </div>
      </div>

      {/* Per-order email override - useful for guest checkouts or when the
          customer asks support to send the receipt to a different address. */}
      <label className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-600">
        Order email (receipts + notifications)
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={customer?.email ?? "guest@example.com"}
        />
      </label>

      {/* Shipping address - partial patch on save, so an empty optional
          field clears it server-side. */}
      <div className="mt-1 rounded-sm border border-dashed border-neutral-300 p-1">
        <div className="mb-0.5 flex items-center gap-0.5 text-xs font-medium text-ink">
          <MapPin className="h-2 w-2" aria-hidden /> Shipping address
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600 sm:col-span-2">
            Full name
            <Input value={address.fullName} onChange={upd("fullName")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
            Phone
            <Input value={address.phone} onChange={upd("phone")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
            Alt phone
            <Input value={address.altPhone ?? ""} onChange={upd("altPhone")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600 sm:col-span-2">
            Address line 1
            <Input value={address.line1} onChange={upd("line1")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600 sm:col-span-2">
            Address line 2
            <Input value={address.line2 ?? ""} onChange={upd("line2")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
            City
            <Input value={address.city} onChange={upd("city")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
            District
            <Input value={address.district} onChange={upd("district")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
            Division
            <Input value={address.division ?? ""} onChange={upd("division")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
            Postal code
            <Input value={address.postalCode ?? ""} onChange={upd("postalCode")} />
          </label>
        </div>
      </div>

      {/* Notes - customer-facing is shown on the invoice; internal stays
          admin-only and is handy for the support handoff log. */}
      <div className="mt-1 grid grid-cols-1 gap-1">
        <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
          <span className="flex items-center gap-0.5">
            <StickyNote className="h-2 w-2" aria-hidden /> Customer-facing note
          </span>
          <textarea
            className="w-full rounded-sm border border-neutral-300 px-1 py-0.5 text-sm focus-visible:border-ink focus-visible:outline-none"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={2}
            placeholder="Visible on the invoice"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
          <span className="flex items-center gap-0.5">
            <StickyNote className="h-2 w-2" aria-hidden /> Internal note (admin-only)
          </span>
          <textarea
            className="w-full rounded-sm border border-neutral-300 px-1 py-0.5 text-sm focus-visible:border-ink focus-visible:outline-none"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            placeholder="Won't appear on the invoice"
          />
        </label>
      </div>

      <div className="mt-1 flex items-center justify-end gap-0.5">
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={patch.isPending}
          >
            Discard
          </Button>
        ) : null}
        <Button size="sm" onClick={onSave} disabled={!dirty || patch.isPending}>
          {patch.isPending ? (
            <Loader2 className="h-2 w-2 animate-spin" aria-hidden />
          ) : dirty ? (
            <Save className="h-2 w-2" aria-hidden />
          ) : (
            <CheckCircle2 className="h-2 w-2" aria-hidden />
          )}
          <span className="ml-0.5">{dirty ? "Save changes" : "Saved"}</span>
        </Button>
      </div>
    </section>
  );
}

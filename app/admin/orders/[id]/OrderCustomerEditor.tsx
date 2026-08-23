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
import { Avatar, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
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
    city: a.city?.trim() || undefined,
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

const fieldLabel = "flex flex-col gap-[6px] text-[13px] font-medium text-gray-500";

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
    <section className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <h2 className="mb-[16px] flex items-center gap-[8px] text-[16px] font-semibold text-gray-900">
        <User className="h-[16px] w-[16px] text-gray-400" aria-hidden /> Customer
      </h2>

      {/* Customer block - the shipping snapshot is the source of truth for
          who the buyer is: on walk-in POS orders the linked user record is
          the cashier, never the customer. */}
      <div className="flex items-start gap-[12px]">
        <Avatar
          src={undefined}
          alt={order.shippingAddress?.fullName || customer?.name || order.email || "Guest"}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[8px]">
            <span className="truncate text-[14px] font-semibold text-gray-900">
              {order.shippingAddress?.fullName || customer?.name || "Guest"}
            </span>
            {order.channel === "pos" ? (
              <span className="shrink-0 rounded-[4px] bg-purple-100 px-[8px] py-[2px] text-[11px] font-medium text-purple-800">
                POS
              </span>
            ) : null}
          </div>
          {order.channel !== "pos" ? (
            <div className="truncate text-[13px] text-gray-500">
              Account email: {customer?.email ?? "-"}
            </div>
          ) : null}
          {order.shippingAddress?.phone || customer?.phone ? (
            <div className="flex items-center gap-[6px] text-[13px] text-gray-500">
              <Phone className="h-[13px] w-[13px]" aria-hidden />
              {order.shippingAddress?.phone || customer?.phone}
            </div>
          ) : null}
        </div>
      </div>

      {/* Per-order email override - useful for guest checkouts or when the
          customer asks support to send the receipt to a different address. */}
      <label className={cn(fieldLabel, "mt-[16px]")}>
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
      <div className="mt-[16px] rounded-[8px] border border-dashed border-gray-300 p-[12px]">
        <div className="mb-[8px] flex items-center gap-[6px] text-[13px] font-medium text-gray-900">
          <MapPin className="h-[14px] w-[14px] text-gray-400" aria-hidden /> Shipping address
        </div>
        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <label className={cn(fieldLabel, "sm:col-span-2")}>
            Full name
            <Input value={address.fullName} onChange={upd("fullName")} />
          </label>
          <label className={fieldLabel}>
            Phone
            <Input value={address.phone} onChange={upd("phone")} />
          </label>
          <label className={fieldLabel}>
            Alt phone
            <Input value={address.altPhone ?? ""} onChange={upd("altPhone")} />
          </label>
          <label className={cn(fieldLabel, "sm:col-span-2")}>
            Address line 1
            <Input value={address.line1} onChange={upd("line1")} />
          </label>
          <label className={cn(fieldLabel, "sm:col-span-2")}>
            Address line 2
            <Input value={address.line2 ?? ""} onChange={upd("line2")} />
          </label>
          <label className={fieldLabel}>
            District
            <Input value={address.district} onChange={upd("district")} />
          </label>
          <label className={fieldLabel}>
            Division
            <Input value={address.division ?? ""} onChange={upd("division")} />
          </label>
          <label className={fieldLabel}>
            Postal code
            <Input value={address.postalCode ?? ""} onChange={upd("postalCode")} />
          </label>
        </div>
      </div>

      {/* Notes - customer-facing is shown on the invoice; internal stays
          admin-only and is handy for the support handoff log. */}
      <div className="mt-[16px] grid grid-cols-1 gap-[12px]">
        <label className={fieldLabel}>
          <span className="flex items-center gap-[6px]">
            <StickyNote className="h-[14px] w-[14px] text-gray-400" aria-hidden /> Customer-facing note
          </span>
          <textarea
            className="w-full rounded-[8px] border border-gray-300 bg-gray-50 px-[12px] py-[10px] text-[14px] text-gray-900 focus:border-[#1A56DB] focus:bg-white focus:outline-none"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={2}
            placeholder="Visible on the invoice"
          />
        </label>
        <label className={fieldLabel}>
          <span className="flex items-center gap-[6px]">
            <StickyNote className="h-[14px] w-[14px] text-gray-400" aria-hidden /> Internal note (admin-only)
          </span>
          <textarea
            className="w-full rounded-[8px] border border-gray-300 bg-gray-50 px-[12px] py-[10px] text-[14px] text-gray-900 focus:border-[#1A56DB] focus:bg-white focus:outline-none"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            placeholder="Won't appear on the invoice"
          />
        </label>
      </div>

      <div className="mt-[16px] flex items-center justify-end gap-[8px]">
        {dirty ? (
          /* Flowbite alternative button */
          <button
            type="button"
            onClick={onReset}
            disabled={patch.isPending}
            className="inline-flex h-[36px] items-center rounded-[8px] border border-gray-300 bg-white px-[14px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard
          </button>
        ) : null}
        {/* Flowbite primary button */}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || patch.isPending}
          className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[14px] text-[13px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {patch.isPending ? (
            <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
          ) : dirty ? (
            <Save className="h-[14px] w-[14px]" aria-hidden />
          ) : (
            <CheckCircle2 className="h-[14px] w-[14px]" aria-hidden />
          )}
          {dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </section>
  );
}


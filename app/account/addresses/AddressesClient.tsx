"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { Plus, Star, Trash2, Pencil, Check, X } from "lucide-react";
import { Button, Input, Label, Spinner, Badge } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from "@/hooks/useCommerce";
import type { Address, AddressInput } from "@/types/commerce";

/* ───────────────────── Form schema ───────────────────── */

const formSchema = z.object({
  label: z.string().max(50).optional().or(z.literal("")),
  fullName: z.string().min(2, "Full name is required").max(120),
  phone: z.string().min(5, "Phone is required").max(20),
  altPhone: z.string().max(20).optional().or(z.literal("")),
  line1: z.string().min(3, "Address is required").max(200),
  line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(1, "City is required").max(80),
  district: z.string().min(1, "District is required").max(80),
  division: z.string().max(80).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(3).optional(),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  label: "",
  fullName: "",
  phone: "",
  altPhone: "",
  line1: "",
  line2: "",
  city: "",
  district: "",
  division: "",
  postalCode: "",
  country: "BD",
};

function addressToForm(a: Address): FormValues {
  return {
    label: a.label ?? "",
    fullName: a.fullName,
    phone: a.phone,
    altPhone: a.altPhone ?? "",
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    district: a.district,
    division: a.division ?? "",
    postalCode: a.postalCode ?? "",
    country: a.country ?? "BD",
  };
}

function formToInput(v: FormValues): AddressInput {
  return {
    label: v.label || undefined,
    fullName: v.fullName,
    phone: v.phone,
    altPhone: v.altPhone || undefined,
    line1: v.line1,
    line2: v.line2 || undefined,
    city: v.city,
    district: v.district,
    division: v.division || undefined,
    postalCode: v.postalCode || undefined,
    country: v.country || "BD",
  };
}

/* ───────────────────── Page client ───────────────────── */

export function AddressesClient() {
  const { status } = useSession();
  const enabled = status === "authenticated";

  const { data: addresses, isLoading } = useAddresses(enabled);
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const toast = useUIStore((s) => s.toast);
  const [mode, setMode] = React.useState<"list" | "create" | { edit: string }>("list");

  if (isLoading || !addresses) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  const editingId = typeof mode === "object" ? mode.edit : null;
  const editing = editingId ? addresses.find((a) => a._id === editingId) : null;

  const onCreate = async (values: FormValues) => {
    try {
      await create.mutateAsync(formToInput(values));
      toast({ title: "Address saved", tone: "success" });
      setMode("list");
    } catch (err) {
      toast({
        title: "Could not save address",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    }
  };

  const onEdit = async (id: string, values: FormValues) => {
    try {
      await update.mutateAsync({ id, patch: formToInput(values) });
      toast({ title: "Address updated", tone: "success" });
      setMode("list");
    } catch (err) {
      toast({
        title: "Could not update address",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    }
  };

  const onDelete = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this address?")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "Address removed", tone: "success" });
    } catch (err) {
      toast({
        title: "Could not delete address",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    }
  };

  const onSetDefault = async (id: string) => {
    try {
      await setDefault.mutateAsync(id);
      toast({ title: "Default address updated", tone: "success" });
    } catch (err) {
      toast({
        title: "Could not update default",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    }
  };

  if (mode === "create") {
    return (
      <AddressForm
        title="Add an address"
        defaults={EMPTY}
        submitting={create.isPending}
        onCancel={() => setMode("list")}
        onSubmit={onCreate}
      />
    );
  }

  if (editing) {
    return (
      <AddressForm
        title="Edit address"
        defaults={addressToForm(editing)}
        submitting={update.isPending}
        onCancel={() => setMode("list")}
        onSubmit={(values) => onEdit(editing._id!, values)}
      />
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-paper py-6 text-center">
        <p className="text-base font-medium">No saved addresses yet</p>
        <p className="max-w-sm text-sm text-neutral-600">
          Save an address now and we&apos;ll prefill it for you at checkout.
        </p>
        <Button onClick={() => setMode("create")} className="mt-1">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="ml-1.5">Add address</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <Button onClick={() => setMode("create")} size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="ml-1.5">Add address</span>
        </Button>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {addresses.map((a) => (
          <li
            key={a._id}
            className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-paper p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-ink">
                  {a.label ?? a.fullName}
                </span>
                {a.isDefault ? (
                  <Badge variant="solid" className="gap-1">
                    <Star className="h-3 w-3" aria-hidden />
                    Default
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode({ edit: a._id! })}
                  aria-label={`Edit ${a.label ?? a.fullName}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:border-ink hover:text-ink"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(a._id!)}
                  aria-label={`Delete ${a.label ?? a.fullName}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:border-red-300 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
            <p className="text-sm text-ink">{a.fullName}</p>
            <p className="text-sm text-neutral-600">{a.phone}</p>
            <p className="text-sm text-neutral-600">
              {[a.line1, a.line2, a.city, a.district, a.division, a.postalCode]
                .filter(Boolean)
                .join(", ")}
            </p>
            {!a.isDefault ? (
              <button
                type="button"
                onClick={() => onSetDefault(a._id!)}
                className="mt-0.5 self-start text-xs font-medium text-neutral-600 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Set as default
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────── Address form ───────────────────── */

interface AddressFormProps {
  title: string;
  defaults: FormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
}

function AddressForm({ title, defaults, submitting, onCancel, onSubmit }: AddressFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-paper p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Label" error={errors.label?.message} optional>
          <Input placeholder="Home, Office…" {...register("label")} invalid={!!errors.label} />
        </Field>
        <Field label="Full name" error={errors.fullName?.message} required>
          <Input autoComplete="name" {...register("fullName")} invalid={!!errors.fullName} />
        </Field>
        <Field label="Phone" error={errors.phone?.message} required>
          <Input
            type="tel"
            autoComplete="tel"
            placeholder="+8801…"
            {...register("phone")}
            invalid={!!errors.phone}
          />
        </Field>
        <Field label="Alt phone" error={errors.altPhone?.message} optional>
          <Input type="tel" {...register("altPhone")} invalid={!!errors.altPhone} />
        </Field>
        <Field label="Address line 1" error={errors.line1?.message} required>
          <Input
            autoComplete="address-line1"
            {...register("line1")}
            invalid={!!errors.line1}
          />
        </Field>
        <Field label="Address line 2" error={errors.line2?.message} optional>
          <Input
            autoComplete="address-line2"
            {...register("line2")}
            invalid={!!errors.line2}
          />
        </Field>
        <Field label="City" error={errors.city?.message} required>
          <Input
            autoComplete="address-level2"
            {...register("city")}
            invalid={!!errors.city}
          />
        </Field>
        <Field label="District" error={errors.district?.message} required>
          <Input
            autoComplete="address-level1"
            {...register("district")}
            invalid={!!errors.district}
          />
        </Field>
        <Field label="Division" error={errors.division?.message} optional>
          <Input {...register("division")} invalid={!!errors.division} />
        </Field>
        <Field label="Postal code" error={errors.postalCode?.message} optional>
          <Input
            autoComplete="postal-code"
            {...register("postalCode")}
            invalid={!!errors.postalCode}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          <Check className="h-4 w-4" aria-hidden />
          <span className="ml-1.5">Save address</span>
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}

function Field({ label, error, required, optional, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label required={required}>
        {label}
        {optional ? <span className="ml-0.5 text-xs text-neutral-500">(optional)</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-ink">{error}</p> : null}
    </div>
  );
}

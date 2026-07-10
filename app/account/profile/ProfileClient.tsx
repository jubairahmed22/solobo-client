"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { ImageUploader } from "@/components/composed/ImageUploader";
import { useUIStore } from "@/store/uiStore";
import { useMe, useUpdateProfile } from "@/hooks/useUsers";
import { UsersError } from "@/lib/api/users";
import type { UploadedImage } from "@/types/uploads";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(100, "Too long"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number")
    .or(z.literal("")),
  avatar: z.string().url("Invalid URL").or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

/**
 * Read-write profile card. We pull authoritative state from /api/users/me on
 * mount, prefill the form, and PATCH on submit. The session-side name is left
 * alone - the form invalidates the React Query cache and the next /me fetch
 * reflects the change. NextAuth's session token only updates on next sign-in,
 * which is acceptable for the v1 of this page.
 */
export function ProfileClient() {
  const { status } = useSession();
  const { data, isLoading } = useMe(status === "authenticated");
  const update = useUpdateProfile();
  const toast = useUIStore((s) => s.toast);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", avatar: "" },
  });

  // Prefill once /me arrives.
  React.useEffect(() => {
    if (data?.user) {
      reset({
        name: data.user.name ?? "",
        // `phone` lives on the user object (not the /me envelope).
        phone: data.user.phone ?? "",
        avatar: data.user.avatar ?? "",
      });
    }
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        name: values.name,
        phone: values.phone, // empty string clears server-side
        avatar: values.avatar,
      });
      toast({ title: "Profile updated", tone: "success" });
      reset(values); // re-baseline so isDirty resets
    } catch (err) {
      if (err instanceof UsersError) {
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const path = fe.path.split(".").pop() as keyof FormValues | undefined;
            if (path && (path === "name" || path === "phone" || path === "avatar")) {
              setError(path, { message: fe.message });
            }
          }
        }
        toast({ title: "Could not save", description: err.message, tone: "error" });
      } else {
        toast({
          title: "Something went wrong",
          description: "Please try again in a moment.",
          tone: "error",
        });
      }
    }
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-paper p-4"
    >
      <div className="flex flex-col gap-1">
        <Label>Email</Label>
        <Input value={data.user.email} disabled readOnly />
        <p className="text-xs text-neutral-500">
          Your email is locked once verified. Contact support to change it.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="name" required>
          Full name
        </Label>
        <Input
          id="name"
          autoComplete="name"
          invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name ? <p className="text-xs text-ink">{errors.name.message}</p> : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+8801…"
          invalid={!!errors.phone}
          {...register("phone")}
        />
        {errors.phone ? (
          <p className="text-xs text-ink">{errors.phone.message}</p>
        ) : (
          <p className="text-xs text-neutral-500">
            Used for delivery updates. Leave blank to remove.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {/* Drag-and-drop single-image avatar uploader. The form still stores
            a plain URL string under `avatar` - we just bridge UploadedImage[]
            ↔ URL via Controller so the API payload stays unchanged. */}
        <Controller
          control={control}
          name="avatar"
          render={({ field }) => {
            const uploaderValue: UploadedImage[] = field.value
              ? [{ url: field.value }]
              : [];
            return (
              <div className="flex flex-col gap-1">
                <ImageUploader
                  label="Avatar"
                  hint="Drop or pick a file. Square image works best - shown next to your reviews and comments."
                  scope="avatar"
                  max={1}
                  hideAlt
                  value={uploaderValue}
                  onChange={(next) => field.onChange(next[0]?.url ?? "")}
                />
                {errors.avatar?.message ? (
                  <p className="text-xs text-ink">{errors.avatar.message}</p>
                ) : null}
              </div>
            );
          }}
        />
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
        <p className="text-xs text-neutral-500">
          {data.coins.toLocaleString()} coins on your account.
        </p>
        <Button
          type="submit"
          loading={update.isPending}
          disabled={!isDirty || update.isPending}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}

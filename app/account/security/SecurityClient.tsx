"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";
import { useChangePassword } from "@/hooks/useUsers";
import { UsersError } from "@/lib/api/users";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "Too long")
      .regex(/[A-Z]/, "Must include an uppercase letter")
      .regex(/[a-z]/, "Must include a lowercase letter")
      .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must be different from current",
    path: ["newPassword"],
  });
type FormValues = z.infer<typeof schema>;

/**
 * Password change form. The backend revokes every refresh token on success, so
 * after we get a 200 we sign the current session out and bounce to /login.
 */
export function SecurityClient() {
  const router = useRouter();
  const change = useChangePassword();
  const toast = useUIStore((s) => s.toast);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      toast({
        title: "Password updated",
        description: "Sign back in with your new password.",
        tone: "success",
      });
      // Sign out without auto-redirect so we can route to /login ourselves.
      await signOut({ redirect: false });
      router.replace("/login");
    } catch (err) {
      if (err instanceof UsersError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setError("currentPassword", { message: "That doesn't match your current password." });
        } else if (err.code === "NO_PASSWORD") {
          toast({
            title: "Use the password reset flow",
            description:
              "Your account uses social sign-in. Set a password via the forgot-password link first.",
            tone: "info",
          });
        } else if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const path = fe.path.split(".").pop() as keyof FormValues | undefined;
            if (path && (path === "currentPassword" || path === "newPassword")) {
              setError(path, { message: fe.message });
            }
          }
        } else {
          toast({ title: "Could not update password", description: err.message, tone: "error" });
        }
      } else {
        toast({
          title: "Something went wrong",
          description: "Please try again in a moment.",
          tone: "error",
        });
      }
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-paper p-4"
    >
      <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        <p>
          For your safety, we&apos;ll sign you out of every device after the password
          changes. You&apos;ll need to sign in again with the new password.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="currentPassword" required>
          Current password
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          invalid={!!errors.currentPassword}
          {...register("currentPassword")}
        />
        {errors.currentPassword ? (
          <p className="text-xs text-ink">{errors.currentPassword.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="newPassword" required>
          New password
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
        {errors.newPassword ? (
          <p className="text-xs text-ink">{errors.newPassword.message}</p>
        ) : (
          <p className="text-xs text-neutral-500">
            8+ characters with uppercase, lowercase, and a number.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="confirmPassword" required>
          Confirm new password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-ink">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-neutral-100 pt-3">
        <Button type="submit" loading={change.isPending}>
          Update password
        </Button>
      </div>
    </form>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/layout";
import { Button, Input, Label } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";
import { authApi, AuthError } from "@/lib/api/auth";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/[a-z]/, "Needs a lowercase letter")
      .regex(/\d/, "Needs a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useUIStore((s) => s.toast);
  const token = params.get("token") ?? "";

  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <AuthLayout
        title="Reset link is invalid"
        subtitle="The link is missing a token. Request a new password-reset email and try again."
        altPrompt={{ question: "Need a new link?", ctaLabel: "Forgot password", ctaHref: "/forgot-password" }}
      >
        <Link
          href="/forgot-password"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-ink text-sm font-medium text-paper transition-colors hover:bg-neutral-800"
        >
          Request new link
        </Link>
      </AuthLayout>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, values.password);
      toast({
        title: "Password updated",
        description: "Sign in with your new password.",
        tone: "success",
      });
      router.push("/login");
    } catch (err) {
      const desc =
        err instanceof AuthError
          ? err.message
          : "The link may be invalid or expired. Please request a new one.";
      toast({ title: "Could not reset password", description: desc, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Pick something you'll remember - or store it in a password manager."
      altPrompt={{ question: "Back to", ctaLabel: "Sign in", ctaHref: "/login" }}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <Label htmlFor="password" required>New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-ink">{errors.password.message}</p>
          ) : (
            <p className="text-xs text-neutral-500">8+ chars, with uppercase, lowercase, and a number.</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="confirm" required>Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm ? <p className="text-xs text-ink">{errors.confirm.message}</p> : null}
        </div>

        <Button type="submit" loading={submitting} fullWidth size="lg">
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}

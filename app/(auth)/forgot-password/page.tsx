"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/layout";
import { Button, Input, Label } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";
import { authApi, AuthError } from "@/lib/api/auth";
import { COMPANY } from "@/lib/entity/company";

const schema = z.object({
  email: z.string().email("Invalid email"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const toast = useUIStore((s) => s.toast);
  const [submitting, setSubmitting] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const email = values.email.trim().toLowerCase();
    try {
      await authApi.forgotPassword(email);
      setSubmittedEmail(email);
    } catch (err) {
      // Backend should always 200 on this endpoint to prevent enumeration,
      // but handle the unexpected case anyway.
      const desc = err instanceof AuthError ? err.message : "Please try again in a moment.";
      toast({ title: "Could not send reset link", description: desc, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  });

  if (submittedEmail) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`If an account exists for ${submittedEmail}, we just sent a password-reset link.`}
        altPrompt={{ question: "Back to", ctaLabel: "Sign in", ctaHref: "/login" }}
      >
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <p>The link expires in 1 hour. If it doesn&apos;t arrive in a few minutes, check your spam folder.</p>
          <button
            type="button"
            onClick={() => setSubmittedEmail(null)}
            className="self-start text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
      altPrompt={{ question: "Remembered it?", ctaLabel: "Sign in", ctaHref: "/login" }}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email ? <p className="text-xs text-ink">{errors.email.message}</p> : null}
        </div>

        <Button type="submit" loading={submitting} fullWidth size="lg">
          Send reset link
        </Button>

        <p className="text-center text-xs text-neutral-500">
          New to {COMPANY.name}?{" "}
          <Link href="/register" className="font-medium text-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

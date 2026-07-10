"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/layout";
import { Button, Input, Label, Divider } from "@/components/ui";
import { COMPANY } from "@/lib/entity/company";
import { useUIStore } from "@/store/uiStore";
import { authApi, AuthError } from "@/lib/api/auth";
import { signIn } from "next-auth/react";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(80, "Too long"),
  email: z.string().email("Invalid email"),
  phone: z
    .string()
    .trim()
    .max(20, "Too long")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Needs an uppercase letter")
    .regex(/[a-z]/, "Needs a lowercase letter")
    .regex(/\d/, "Needs a number"),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await authApi.register({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        phone: values.phone?.trim() || undefined,
      });
      toast({
        title: "Check your email",
        description: "We sent you a 6-digit verification code.",
        tone: "success",
      });
      router.push(`/verify?email=${encodeURIComponent(values.email.trim().toLowerCase())}`);
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const path = fe.path.split(".").pop() as keyof FormValues;
            if (path && (path === "name" || path === "email" || path === "phone" || path === "password")) {
              setError(path, { message: fe.message });
            }
          }
        }
        toast({ title: "Could not create account", description: err.message, tone: "error" });
      } else {
        toast({
          title: "Something went wrong",
          description: "Please try again in a moment.",
          tone: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  });

  const oauth = (provider: "google" | "facebook") => {
    signIn(provider, { callbackUrl: "/" });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle={`Join ${COMPANY.name} in under a minute.`}
      altPrompt={{ question: "Already have an account?", ctaLabel: "Sign in", ctaHref: "/login" }}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <Label htmlFor="name" required>Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name ? <p className="text-xs text-ink">{errors.name.message}</p> : null}
        </div>

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

        <div className="flex flex-col gap-1">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+8801…"
            invalid={!!errors.phone}
            {...register("phone")}
          />
          {errors.phone ? <p className="text-xs text-ink">{errors.phone.message}</p> : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="password" required>Password</Label>
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

        <p className="text-xs text-neutral-500">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy Policy</Link>.
        </p>

        <Button type="submit" loading={submitting} fullWidth size="lg">
          Create account
        </Button>
      </form>

      <Divider label="or" className="my-4" />

      <div className="flex flex-col gap-2">
        <Button variant="secondary" fullWidth size="lg" onClick={() => oauth("google")}>
          Continue with Google
        </Button>
        <Button variant="secondary" fullWidth size="lg" onClick={() => oauth("facebook")}>
          Continue with Facebook
        </Button>
      </div>
    </AuthLayout>
  );
}

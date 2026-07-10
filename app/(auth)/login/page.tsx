"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/layout";
import { Button, Input, Label, Divider } from "@/components/ui";
import { COMPANY } from "@/lib/entity/company";
import { useUIStore } from "@/store/uiStore";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  // Accept either ?from= (legacy) or ?next= (used by account/* and reviews)
  // so deep-link bounces from any guarded surface land back where the user
  // started.
  const from = params.get("from") ?? params.get("next") ?? "/";
  const verified = params.get("verified") === "1";
  const presetEmail = params.get("email") ?? "";
  const toast = useUIStore((s) => s.toast);

  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: presetEmail, password: "" },
  });

  // One-shot success toast when arriving from /verify.
  const shownVerifiedToast = React.useRef(false);
  React.useEffect(() => {
    if (verified && !shownVerifiedToast.current) {
      shownVerifiedToast.current = true;
      toast({
        title: "Email verified",
        description: "Sign in to finish setting up your account.",
        tone: "success",
      });
    }
  }, [verified, toast]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const res = await signIn("credentials", {
      ...values,
      redirect: false,
    });
    setSubmitting(false);

    if (!res || res.error) {
      toast({
        title: "Sign in failed",
        description: "Check your email and password, then try again.",
        tone: "error",
      });
      return;
    }
    router.push(from);
    router.refresh();
  });

  const oauth = (provider: "google" | "facebook") => {
    signIn(provider, { callbackUrl: from });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={`Sign in to your ${COMPANY.name} account.`}
      altPrompt={{ question: `New to ${COMPANY.name}?`, ctaLabel: "Create an account", ctaHref: "/register" }}
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

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-neutral-600 underline-offset-2 hover:underline"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? <p className="text-xs text-ink">{errors.password.message}</p> : null}
        </div>

        <Button type="submit" loading={submitting} fullWidth size="lg">
          Sign in
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

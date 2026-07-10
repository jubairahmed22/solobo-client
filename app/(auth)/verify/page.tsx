"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout";
import { Button } from "@/components/ui";
import { useUIStore } from "@/store/uiStore";
import { authApi, AuthError } from "@/lib/api/auth";
import { cn } from "@/lib/utils/cn";

const OTP_LEN = 6;
const RESEND_COOLDOWN_S = 60;

export default function VerifyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useUIStore((s) => s.toast);
  const email = (params.get("email") ?? "").toLowerCase();

  const [digits, setDigits] = React.useState<string[]>(() => Array.from({ length: OTP_LEN }, () => ""));
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

  // Cooldown ticker.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  // Focus the first empty box on mount.
  React.useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Redirect if no email param - they shouldn't be on this page directly.
  React.useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  const code = digits.join("");
  const codeComplete = code.length === OTP_LEN && /^\d{6}$/.test(code);

  const updateDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    if (clean && i < OTP_LEN - 1) inputsRef.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputsRef.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LEN - 1) {
      inputsRef.current[i + 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LEN }, (_, i) => text[i] ?? "");
    setDigits(next);
    const lastFilled = Math.min(text.length, OTP_LEN) - 1;
    inputsRef.current[Math.max(0, lastFilled)]?.focus();
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!codeComplete || submitting) return;
    setSubmitting(true);
    try {
      // Verify the OTP. Backend marks email as verified.
      await authApi.verifyOtp(email, code);
      // Now establish a NextAuth session so the cookie/session matches the verified user.
      // The user just verified - but we don't have their password here, so we can't sign in
      // with credentials transparently. Instead, send them to /login with a success flag.
      toast({
        title: "Email verified",
        description: "You can now sign in.",
        tone: "success",
      });
      router.push(`/login?from=/&verified=1&email=${encodeURIComponent(email)}`);
    } catch (err) {
      const desc = err instanceof AuthError ? err.message : "That code didn't work. Please try again.";
      toast({ title: "Verification failed", description: desc, tone: "error" });
      setDigits(Array.from({ length: OTP_LEN }, () => ""));
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when all 6 digits are entered.
  React.useEffect(() => {
    if (codeComplete && !submitting) void onSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeComplete]);

  const onResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await authApi.requestOtp(email);
      toast({
        title: "Code re-sent",
        description: "We sent a fresh code to your email.",
        tone: "success",
      });
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      const desc = err instanceof AuthError ? err.message : "Could not resend the code.";
      toast({ title: "Resend failed", description: desc, tone: "error" });
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${email}.`}
      altPrompt={{ question: "Wrong address?", ctaLabel: "Start over", ctaHref: "/register" }}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex gap-[8px]" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={d}
              onChange={(e) => updateDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              className={cn(
                "h-[44px] min-w-0 flex-1 rounded-lg border border-neutral-300 bg-paper text-center text-xl font-semibold text-ink",
                "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
                "transition-colors duration-hover ease-out",
              )}
            />
          ))}
        </div>

        <Button type="submit" loading={submitting} disabled={!codeComplete} fullWidth size="lg">
          Verify
        </Button>

        <div className="flex items-center justify-center gap-1.5 text-sm text-neutral-600">
          <span>Didn&apos;t get a code?</span>
          <button
            type="button"
            onClick={onResend}
            disabled={resending || cooldown > 0}
            className="font-medium text-ink underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

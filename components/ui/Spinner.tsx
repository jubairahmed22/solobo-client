import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE = {
  sm: "h-2 w-2 border-2",
  md: "h-3 w-3 border-2",
  lg: "h-4 w-4 border-[3px]",
} as const;

export function Spinner({ size = "md", label = "Loading…", className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    >
      <span
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent text-ink",
          SIZE[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

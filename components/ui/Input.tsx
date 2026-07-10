import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-5 w-full rounded-lg border border-neutral-300 bg-paper px-2 text-sm text-ink",
          "placeholder:text-neutral-400",
          "transition-colors duration-hover ease-out",
          "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
          invalid && "border-ink ring-1 ring-ink",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1 whitespace-nowrap font-bold uppercase tracking-widest",
    "transition-all duration-hover ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        // Black fill - main CTA
        primary: "bg-ink text-paper hover:bg-neutral-800",
        // Red fill - high-emphasis CTA
        accent: "bg-accent text-paper hover:opacity-90",
        // Outlined black border
        secondary: "border border-ink bg-paper text-ink hover:bg-neutral-50",
        // Ghost - no background
        ghost: "bg-transparent text-ink hover:bg-neutral-100",
        // Text link
        link: "text-ink underline-offset-4 hover:underline",
        // White on dark backgrounds
        onDark: "bg-paper text-ink hover:bg-neutral-100",
        // Outlined white - for use on dark backgrounds
        outlineDark: "border border-paper text-paper hover:bg-white/10",
      },
      size: {
        // NOTE: this project's Tailwind spacing scale is 8px per unit, so
        // h-8/h-10/h-12 would render 64/80/96px tall. Explicit px keeps the
        // standard 32/40/48px control heights.
        sm: "h-[32px] px-[12px] text-xs",
        md: "h-[40px] px-[16px] text-xs",
        lg: "h-[48px] px-[24px] text-sm",
        icon: "h-[40px] w-[40px]",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };

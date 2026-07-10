import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        solid: "bg-ink text-paper",
        outline: "border border-ink text-ink",
        muted: "bg-neutral-100 text-neutral-700",
      },
    },
    defaultVariants: { variant: "solid" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

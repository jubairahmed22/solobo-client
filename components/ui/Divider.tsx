import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  label?: string;
}

export function Divider({
  orientation = "horizontal",
  label,
  className,
  ...props
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn("h-full w-px bg-neutral-200", className)}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        className={cn("flex items-center gap-2 text-xs text-neutral-500", className)}
        {...props}
      >
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="uppercase tracking-widest">{label}</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("h-px w-full bg-neutral-200", className)}
      {...props}
    />
  );
}

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  invalid?: boolean;
  containerClassName?: string;
}

/**
 * Native <select> styled to match the design system.
 * For multi-select / search-in-options use a Combobox component (deferred).
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, invalid, className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "block h-5 w-full appearance-none rounded-sm border border-neutral-300 bg-paper pl-2 pr-5 text-sm text-ink",
            "transition-colors duration-hover ease-out",
            "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
            invalid && "border-ink ring-1 ring-ink",
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 top-1/2 h-2 w-2 -translate-y-1/2 text-neutral-500"
          aria-hidden
        />
      </div>
    );
  },
);
Select.displayName = "Select";

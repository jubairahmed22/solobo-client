"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";

export interface SearchbarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onValueChange?: (value: string) => void;
  /** Fires after `debounceMs` of stillness. */
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  onClear?: () => void;
  containerClassName?: string;
}

export const Searchbar = React.forwardRef<HTMLInputElement, SearchbarProps>(
  (
    {
      value: controlled,
      defaultValue = "",
      onValueChange,
      onDebouncedChange,
      debounceMs = 300,
      onClear,
      placeholder = "Search products…",
      containerClassName,
      className,
      ...props
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState<string>(String(controlled ?? defaultValue));
    const isControlled = controlled !== undefined;
    const value = isControlled ? String(controlled) : internal;
    const debounced = useDebounce(value, debounceMs);

    React.useEffect(() => {
      onDebouncedChange?.(debounced);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    };

    const handleClear = () => {
      if (!isControlled) setInternal("");
      onValueChange?.("");
      onClear?.();
    };

    return (
      <div
        className={cn(
          "relative flex items-center gap-1 rounded-sm border border-neutral-300 bg-paper px-2 transition-colors duration-hover ease-out focus-within:border-ink focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-1",
          containerClassName,
        )}
      >
        <Search className="h-2 w-2 shrink-0 text-neutral-500" aria-hidden />
        <input
          ref={ref}
          type="search"
          role="searchbox"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "h-5 w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400",
            className,
          )}
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="rounded-sm p-0.5 text-neutral-500 hover:text-ink"
          >
            <X className="h-2 w-2" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  },
);
Searchbar.displayName = "Searchbar";

"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchSuggest } from "@/hooks/useCatalog";
import type { SearchSuggestion } from "@/types/catalog";
import { formatPrice } from "@/lib/utils/format";

export interface SearchSuggestBoxProps {
  defaultValue?: string;
  placeholder?: string;
  onSubmit?: (query: string) => void;
  className?: string;
  /** "amazon" renders the dark/orange Amazon-style bar used on mobile & tablet. */
  variant?: "default" | "amazon";
}

export function SearchSuggestBox({
  defaultValue = "",
  placeholder = "Search By Product Keyword...",
  onSubmit,
  className,
  variant = "default",
}: SearchSuggestBoxProps) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const debounced = useDebounce(value, 250);

  const { data, isFetching } = useSearchSuggest(debounced);

  React.useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [data?.suggestions?.length, data?.corrected]);

  const suggestions: SearchSuggestion[] = data?.suggestions ?? [];
  const correction = data?.corrected ?? null;

  const submitRaw = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    if (onSubmit) onSubmit(trimmed);
    else router.push(`/all-products?q=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setOpen(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        setOpen(false);
        router.push(`/product/${suggestions[activeIndex].slug}`);
      } else {
        e.preventDefault();
        submitRaw(value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showPanel =
    open &&
    debounced.trim().length >= 2 &&
    (suggestions.length > 0 || isFetching || !!correction || debounced.trim().length >= 3);

  const renderPanel = () => (
    <div
      id="search-suggest-panel"
      role="listbox"
      className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
    >
      {correction ? (
        <CorrectionHeader
          corrected={correction}
          original={data?.original ?? debounced.trim()}
          onPick={() => {
            setValue(correction);
            submitRaw(correction);
          }}
          onUseOriginal={() => submitRaw(data?.original ?? debounced.trim())}
        />
      ) : null}

      {suggestions.length === 0 ? (
        <p className="px-4 py-4 text-[14px] text-neutral-500">
          {isFetching ? "Searching…" : "No matches found."}
        </p>
      ) : (
        <ul>
          {suggestions.map((s, i) => (
            <li key={s._id} role="option" aria-selected={i === activeIndex}>
              <Link
                href={`/product/${s.slug}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors",
                  i === activeIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                )}
              >
                <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                  {s.image ? (
                    <Image src={s.image} alt="" fill sizes="36px" className="object-cover" />
                  ) : (
                    <Search className="h-4 w-4 text-neutral-400" />
                  )}
                </span>
                <span className="flex-1 truncate text-neutral-800">{s.name}</span>
                <span className="shrink-0 text-xs font-bold text-neutral-900">
                  {formatPrice(s.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {debounced.trim().length >= 2 && (
        <button
          type="button"
          onClick={() => submitRaw(value)}
          className="flex w-full items-center justify-between gap-2 border-t border-neutral-200 bg-ink px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-paper transition-colors hover:bg-neutral-900"
        >
          <span>See all results for &ldquo;{debounced.trim()}&rdquo;</span>
          <CornerDownLeft className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  if (variant === "amazon") {
    return (
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submitRaw(value);
          }}
          className="flex h-9 w-full items-center overflow-hidden rounded-full bg-white pl-3 pr-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
        >
          {/* Search icon on the left — mirrors the desktop variant */}
          <button
            type="submit"
            aria-label="Search"
            className="mr-2 shrink-0 text-neutral-400 outline-none transition-opacity hover:opacity-75 focus:outline-none"
          >
            <Search className="h-[13px] w-[13px]" aria-hidden />
          </button>

          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            name="q"
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[13px] text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
          />

          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              className="ml-1.5 shrink-0 text-neutral-400 outline-none transition-colors hover:text-neutral-600 focus:outline-none"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </form>

        {showPanel ? renderPanel() : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitRaw(value);
        }}
        className="flex h-[38px] items-center rounded-full border border-neutral-200 bg-white pl-3.5 pr-3 transition-colors focus-within:border-neutral-400 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
      >
        {/* Search icon on the left — acts as submit trigger, stays small */}
        <button
          type="submit"
          aria-label="Search"
          className="mr-2 shrink-0 text-neutral-400 transition-colors hover:text-ink"
        >
          <Search className="h-[15px] w-[15px]" aria-hidden />
        </button>

        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          name="q"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="flex-1 appearance-none bg-transparent text-[14px] text-[#1A1C1E] outline-none ring-0 placeholder:text-neutral-400 focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
        />

        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="ml-1.5 shrink-0 rounded-full p-0.5 text-neutral-400 transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </form>

      {showPanel ? renderPanel() : null}
    </div>
  );
}

function CorrectionHeader({
  corrected,
  original,
  onPick,
  onUseOriginal,
}: {
  corrected: string;
  original: string;
  onPick: () => void;
  onUseOriginal: () => void;
}) {
  return (
    <div className="border-b border-neutral-100 bg-amber-50/40 px-4 py-2">
      <button
        type="button"
        onClick={onPick}
        className="text-left text-[13px] font-bold text-ink hover:underline decoration-accent"
      >
        Did you mean <span className="italic">{corrected}</span>?
      </button>
      <button
        type="button"
        onClick={onUseOriginal}
        className="mt-0.5 block text-[11px] text-neutral-500 hover:underline"
      >
        Search instead for &ldquo;{original}&rdquo;
      </button>
    </div>
  );
}
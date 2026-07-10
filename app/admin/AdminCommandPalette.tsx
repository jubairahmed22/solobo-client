"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  Barcode,
  Building2,
  DollarSign,
  Filter,
  FolderTree,
  HelpCircle,
  History,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageSquare,
  Package,
  Plus,
  Route,
  ScanLine,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ───────────────────── OS detection ───────────────────── */

export function useIsMac(): boolean {
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);
  return isMac;
}

/* ───────────────────── Fuzzy match ───────────────────── */

interface MatchResult {
  score: number;
  /** Indices of matched characters in the target string. */
  indices: number[];
}

/**
 * Character-level fuzzy match. Returns a score and the matched character
 * positions so we can highlight them in the result list.
 *
 * Score: +100 for exact prefix, +10 per consecutive match run, +1 per char.
 * Returns score 0 (no match) when any query char is missing from target.
 */
function fuzzyMatch(target: string, query: string): MatchResult {
  if (!query) return { score: 1, indices: [] };
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  // Exact or starts-with - highest priority
  if (t === q) return { score: 1000, indices: Array.from({ length: t.length }, (_, i) => i) };
  if (t.startsWith(q)) {
    return { score: 500, indices: Array.from({ length: q.length }, (_, i) => i) };
  }

  // Character-by-character fuzzy
  let score = 0;
  const indices: number[] = [];
  let ti = 0;
  let consecutive = 0;

  for (let qi = 0; qi < q.length; qi++) {
    let found = false;
    while (ti < t.length) {
      if (t[ti] === q[qi]) {
        indices.push(ti);
        score += 1 + consecutive * 10; // bonus for runs
        consecutive++;
        ti++;
        found = true;
        break;
      }
      consecutive = 0;
      ti++;
    }
    if (!found) return { score: 0, indices: [] };
  }

  return { score, indices };
}

/* ───────────────────── Item types ───────────────────── */

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  Icon: LucideIcon;
  group: "Navigate" | "Create";
  /** Extra searchable keywords, space-separated. */
  keywords?: string;
}

const ITEMS: PaletteItem[] = [
  // Navigate
  { id: "dashboard",        label: "Dashboard",             href: "/admin",                        Icon: LayoutDashboard, group: "Navigate" },
  { id: "orders",           label: "Orders",                href: "/admin/orders",                 Icon: ShoppingBag,     group: "Navigate" },
  { id: "products",         label: "Products",              href: "/admin/products",               Icon: Package,         group: "Navigate" },
  { id: "categories",       label: "Categories",            href: "/admin/categories",             Icon: FolderTree,      group: "Navigate" },
  { id: "brands",           label: "Brands",                href: "/admin/brands",                 Icon: Tag,             group: "Navigate" },
  { id: "coupons",          label: "Coupons",               href: "/admin/coupons",               Icon: BadgePercent,    group: "Navigate" },
  { id: "offers",           label: "Offers",                href: "/admin/offers",                 Icon: Sparkles,        group: "Navigate" },
  { id: "reviews",          label: "Reviews",               href: "/admin/reviews",               Icon: MessageSquare,   group: "Navigate" },
  { id: "questions",        label: "Q&A",                   href: "/admin/questions",              Icon: HelpCircle,      group: "Navigate", keywords: "questions answers" },
  { id: "users",            label: "Users",                 href: "/admin/users",                  Icon: Users,           group: "Navigate", keywords: "customers accounts" },
  { id: "analytics",        label: "Analytics",             href: "/admin/analytics",              Icon: LineChart,       group: "Navigate" },
  { id: "conversion",       label: "Conversion analytics",  href: "/admin/analytics/conversion",   Icon: Filter,          group: "Navigate", keywords: "funnel checkout" },
  { id: "attribution",      label: "Attribution analytics", href: "/admin/analytics/attribution",  Icon: Route,           group: "Navigate", keywords: "utm source campaign" },
  { id: "financial",        label: "Financial analytics",   href: "/admin/analytics/financial",    Icon: DollarSign,      group: "Navigate", keywords: "revenue profit" },
  { id: "marketing",        label: "Marketing analytics",   href: "/admin/analytics/marketing",    Icon: Megaphone,       group: "Navigate", keywords: "ads campaign" },
  { id: "pos",              label: "POS",                   href: "/admin/pos",                    Icon: ScanLine,        group: "Navigate", keywords: "point of sale" },
  { id: "barcodes",         label: "Barcodes",              href: "/admin/barcodes",               Icon: Barcode,         group: "Navigate", keywords: "scan print label qr code sku" },
  { id: "audit",            label: "Audit log",             href: "/admin/audit",                  Icon: History,         group: "Navigate", keywords: "logs history activity" },
  { id: "company-profile",  label: "Company profile",       href: "/admin/company-profile",        Icon: Building2,       group: "Navigate", keywords: "settings store info" },
  // Create
  { id: "new-product",      label: "New product",           href: "/admin/products/new",           Icon: Plus,            group: "Create" },
  { id: "new-category",     label: "New category",          href: "/admin/categories/new",         Icon: Plus,            group: "Create" },
  { id: "new-brand",        label: "New brand",             href: "/admin/brands/new",             Icon: Plus,            group: "Create" },
  { id: "new-coupon",       label: "New coupon",            href: "/admin/coupons/new",            Icon: Plus,            group: "Create" },
  { id: "new-offer",        label: "New offer",             href: "/admin/offers/new",             Icon: Plus,            group: "Create" },
];

/* ───────────────────── Highlight helper ───────────────────── */

function HighlightedLabel({ label, indices }: { label: string; indices: number[] }) {
  if (indices.length === 0) return <span>{label}</span>;
  const set = new Set(indices);
  return (
    <span>
      {label.split("").map((char, i) =>
        set.has(i) ? (
          <mark key={i} className="bg-transparent font-bold text-ink">
            {char}
          </mark>
        ) : (
          <span key={i} className="text-neutral-500">{char}</span>
        ),
      )}
    </span>
  );
}

/* ───────────────────── Context ───────────────────── */

interface PaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const PaletteContext = React.createContext<PaletteContextValue | null>(null);

export function usePalette() {
  const ctx = React.useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used inside AdminCommandPalette");
  return ctx;
}

/* ───────────────────── Component ───────────────────── */

export function AdminCommandPalette({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isMac = useIsMac();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  /* ── Scoring: fuzzy match label + keywords ── */
  const scored = React.useMemo(() => {
    if (!query.trim()) return ITEMS.map((item) => ({ item, score: 1, indices: [] as number[] }));

    return ITEMS.flatMap((item) => {
      const labelMatch = fuzzyMatch(item.label, query);
      const kwMatch = item.keywords ? fuzzyMatch(item.keywords, query) : { score: 0, indices: [] };
      const score = Math.max(labelMatch.score, kwMatch.score * 0.6);
      if (score === 0) return [];
      // Use label indices for highlighting (keyword matches don't highlight label)
      return [{ item, score, indices: labelMatch.indices }];
    }).sort((a, b) => b.score - a.score);
  }, [query]);

  /* ── Group for rendering ── */
  const groups = React.useMemo(() => {
    const map = new Map<string, typeof scored>();
    for (const entry of scored) {
      const g = entry.item.group;
      map.set(g, [...(map.get(g) ?? []), entry]);
    }
    return map;
  }, [scored]);

  /* ── Open / close ── */
  const openPalette = React.useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closePalette = React.useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const togglePalette = React.useCallback(() => {
    setIsOpen((v) => {
      if (!v) { setQuery(""); setActiveIndex(0); }
      return !v;
    });
  }, []);

  /* ── Global Ctrl+K / Cmd+K ── */
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        togglePalette();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [togglePalette]);

  /* ── Focus input on open ── */
  React.useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  /* ── Reset active index on query change ── */
  React.useEffect(() => { setActiveIndex(0); }, [query]);

  /* ── Scroll active item into view ── */
  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function navigate(href: string) {
    closePalette();
    router.push(href);
  }

  function onKeyDownInPalette(e: React.KeyboardEvent) {
    const grid = !query.trim();
    switch (e.key) {
      case "Escape":
        closePalette();
        break;
      // ↑↓ move one visual row - in grid that's ±2 items, in list it's ±1
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + (grid ? 2 : 1), scored.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - (grid ? 2 : 1), 0));
        break;
      // ←→ move between columns in grid mode only
      case "ArrowRight":
        if (grid) { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, scored.length - 1)); }
        break;
      case "ArrowLeft":
        if (grid) { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
        break;
      // Jump to first / last
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(scored.length - 1);
        break;
      case "Enter": {
        const entry = scored[activeIndex];
        if (entry) navigate(entry.item.href);
        break;
      }
    }
  }

  const ctx: PaletteContextValue = { open: openPalette, close: closePalette, toggle: togglePalette };

  // 2-column grid when no query - fits all items on screen without scrolling
  const isGrid = !query.trim();
  let flatIndex = 0;

  return (
    <PaletteContext.Provider value={ctx}>
      {children}

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[7vh]"
          onKeyDown={onKeyDownInPalette}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
            onClick={closePalette}
            aria-hidden
          />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-[660px] overflow-hidden rounded-sm border border-neutral-200 bg-paper shadow-[0_20px_60px_-10px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.04)]"
            style={{ animation: "palette-in 140ms cubic-bezier(0.16,1,0.3,1) both" }}
            role="dialog"
            aria-modal
            aria-label="Command palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages and actions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-[15px] text-ink placeholder-neutral-400 focus:outline-none"
                aria-autocomplete="list"
              />
              <kbd className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-1 font-mono text-[11px] text-neutral-400">
                Esc
              </kbd>
            </div>

            {/* Results - 2-col grid when idle, single col when filtering */}
            <ul
              ref={listRef}
              className={cn(
                "overflow-y-auto p-1.5",
                isGrid
                  ? "grid grid-cols-2 gap-x-1 max-h-[72vh]"
                  : "max-h-[400px]",
              )}
              role="listbox"
            >
              {scored.length === 0 ? (
                <li className="col-span-2 px-4 py-8 text-center text-sm text-neutral-400">
                  No results for &ldquo;<span className="text-ink">{query}</span>&rdquo;
                </li>
              ) : (
                Array.from(groups.entries()).map(([group, entries]) => (
                  <React.Fragment key={group}>
                    {/* Group header spans both columns */}
                    <li
                      role="presentation"
                      className={cn(
                        "px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400",
                        isGrid && "col-span-2",
                      )}
                    >
                      {group}
                    </li>
                    {entries.map(({ item, indices }) => {
                      const idx = flatIndex++;
                      const isActive = idx === activeIndex;
                      return (
                        <li
                          key={item.id}
                          data-index={idx}
                          role="option"
                          aria-selected={isActive}
                        >
                          <button
                            type="button"
                            onClick={() => navigate(item.href)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-left transition-colors duration-75",
                              isActive
                                ? "bg-ink text-paper"
                                : "hover:bg-neutral-50",
                            )}
                          >
                            <item.Icon
                              className={cn(
                                "h-[15px] w-[15px] shrink-0",
                                isActive ? "text-accent" : "text-neutral-400",
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[13px] font-medium",
                                isActive ? "text-paper" : "text-neutral-800",
                              )}
                            >
                              {query ? (
                                <HighlightedLabel label={item.label} indices={indices} />
                              ) : (
                                item.label
                              )}
                            </span>
                            {isActive ? (
                              <kbd className="ml-auto shrink-0 rounded-sm border border-neutral-700 bg-neutral-800 px-1 py-0.5 font-mono text-[10px] text-neutral-400">
                                ↵
                              </kbd>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </ul>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2">
              <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <kbd className="font-mono">{isGrid ? "↑↓←→" : "↑↓"}</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono">↵</kbd> open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono">Esc</kbd> close
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px]">
                  {isMac ? "⌘" : "Ctrl"}
                </kbd>
                <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px]">
                  K
                </kbd>
                <span className="ml-1">to toggle</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}

    </PaletteContext.Provider>
  );
}

/* ───────────────────── Sidebar trigger helper ───────────────────── */

/** Rendered inside AdminSidebar - shows the OS-correct shortcut hint. */
export function PaletteShortcutHint({ isMac }: { isMac: boolean }) {
  return (
    <span className="flex items-center gap-0.5 font-mono text-[10px] text-neutral-400">
      <kbd className="rounded border border-neutral-200 bg-paper px-1 py-0.5 leading-none">
        {isMac ? "⌘" : "Ctrl"}
      </kbd>
      <kbd className="rounded border border-neutral-200 bg-paper px-1 py-0.5 leading-none">K</kbd>
    </span>
  );
}

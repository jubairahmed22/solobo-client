"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Eye,
  Pencil,
} from "lucide-react";
import { Markdown } from "./Markdown";
import { cn } from "@/lib/utils/cn";

/**
 * MarkdownEditor - a lightweight rich-text editor for admin long-form content.
 *
 * Why markdown (not a full WYSIWYG / contentEditable): markdown is safe to store
 * + render (react-markdown escapes HTML), portable, and diff-friendly. The
 * toolbar wraps/prefixes the current selection with markdown syntax, and a
 * Preview tab shows exactly how it'll look on the storefront. Controlled -
 * pass `value` + `onChange` (works directly with react-hook-form Controller).
 */

export interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
}

const textareaClass =
  "block w-full resize-y rounded-b-sm border border-t-0 border-neutral-300 bg-paper p-2 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none";

export function MarkdownEditor({
  value,
  onChange,
  rows = 12,
  placeholder = "Write here… formatting supported (bold, headings, lists, links).",
  id,
}: MarkdownEditorProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const pendingSel = React.useRef<[number, number] | null>(null);
  const [tab, setTab] = React.useState<"write" | "preview">("write");

  // Restore the caret/selection after a controlled re-render from a toolbar op.
  React.useEffect(() => {
    if (pendingSel.current && ref.current) {
      const [s, e] = pendingSel.current;
      ref.current.focus();
      ref.current.setSelectionRange(s, e);
      pendingSel.current = null;
    }
  }, [value]);

  /** Wrap the current selection with `before`/`after` (inline marks). */
  const surround = (before: string, after: string, ph: string) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = value.slice(s, e) || ph;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    pendingSel.current = [s + before.length, s + before.length + sel.length];
    onChange(next);
  };

  /** Prefix every selected line (headings, quotes, lists). */
  const prefixLines = (prefix: string | ((i: number) => string)) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const block = value.slice(lineStart, e) || "";
    const lines = block.split("\n");
    const out = lines
      .map((l, i) => `${typeof prefix === "function" ? prefix(i) : prefix}${l}`)
      .join("\n");
    const next = value.slice(0, lineStart) + out + value.slice(e);
    pendingSel.current = [lineStart, lineStart + out.length];
    onChange(next);
  };

  const insertLink = () => surround("[", "](https://)", "link text");

  return (
    <div className="rounded-sm border border-neutral-300 focus-within:border-ink">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-sm border-b border-neutral-200 bg-neutral-50 p-1">
        <ToolBtn label="Bold" onClick={() => surround("**", "**", "bold text")}>
          <Bold className="h-[15px] w-[15px]" />
        </ToolBtn>
        <ToolBtn label="Italic" onClick={() => surround("*", "*", "italic text")}>
          <Italic className="h-[15px] w-[15px]" />
        </ToolBtn>
        <Divider />
        <ToolBtn label="Heading" onClick={() => prefixLines("## ")}>
          <Heading2 className="h-[15px] w-[15px]" />
        </ToolBtn>
        <ToolBtn label="Subheading" onClick={() => prefixLines("### ")}>
          <Heading3 className="h-[15px] w-[15px]" />
        </ToolBtn>
        <Divider />
        <ToolBtn label="Bullet list" onClick={() => prefixLines("- ")}>
          <List className="h-[15px] w-[15px]" />
        </ToolBtn>
        <ToolBtn label="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}>
          <ListOrdered className="h-[15px] w-[15px]" />
        </ToolBtn>
        <ToolBtn label="Quote" onClick={() => prefixLines("> ")}>
          <Quote className="h-[15px] w-[15px]" />
        </ToolBtn>
        <ToolBtn label="Link" onClick={insertLink}>
          <Link2 className="h-[15px] w-[15px]" />
        </ToolBtn>

        {/* Write / Preview toggle */}
        <div className="ml-auto flex items-center gap-0.5">
          <TabBtn active={tab === "write"} onClick={() => setTab("write")}>
            <Pencil className="h-[13px] w-[13px]" /> Write
          </TabBtn>
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>
            <Eye className="h-[13px] w-[13px]" /> Preview
          </TabBtn>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          id={id}
          ref={ref}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={textareaClass}
        />
      ) : (
        <div className="min-h-[160px] rounded-b-sm bg-paper p-3">
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <p className="text-sm text-neutral-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // preventDefault keeps focus in the textarea so the selection survives.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-200 hover:text-ink"
    >
      {children}
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] font-medium",
        active ? "bg-ink text-paper" : "text-neutral-600 hover:bg-neutral-200",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-neutral-200" aria-hidden />;
}

"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";

/**
 * Safe markdown renderer for admin-authored content (policy pages, FAQ answers).
 * react-markdown does NOT render raw HTML by default, so user/admin markdown
 * can't inject scripts. Styling comes from the scoped `.markdown` rules in
 * globals.css (links use the Solobo pink, GFM tables/lists supported).
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

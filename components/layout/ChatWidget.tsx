"use client";

import * as React from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { Drawer } from "@/components/complex";
import { chatApi } from "@/lib/api/chat";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ChatCheckoutForm } from "./ChatCheckoutForm";
import type { ChatMessage, OrderPlaced, CheckoutForm } from "@/types/chat";

const SESSION_STORAGE_KEY = "solobo-chat-session-id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, fresh);
  return fresh;
}

const IMAGE_URL_RE = /\.(?:jpe?g|png|webp|gif|avif)(?:\?\S*)?$|\/image\/upload\//i;

function isImageUrl(url: string): boolean {
  return IMAGE_URL_RE.test(url);
}

/**
 * Renders an assistant reply as rich content instead of a raw string. The
 * model is instructed to reply in plain text (see the backend system
 * prompt), but LLMs don't always follow formatting instructions perfectly -
 * so this also recognizes Markdown image/link syntax if it slips through,
 * rather than showing the shopper literal `![alt](url)` brackets. Any
 * detected image URL (Markdown-wrapped or bare) renders as an actual
 * thumbnail; every other URL becomes a clickable link.
 */
function renderMessageContent(text: string): React.ReactNode[] {
  const TOKEN_RE =
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const pushText = (raw: string) => {
    if (!raw) return;
    // Defensive cleanup for stray Markdown emphasis the model wasn't supposed to use.
    const cleaned = raw.replace(/\*\*(.*?)\*\*/g, "$1");
    nodes.push(<React.Fragment key={key++}>{cleaned}</React.Fragment>);
  };

  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    pushText(text.slice(lastIndex, index));

    const [, imgAlt, imgUrl, linkText, linkUrl, bareUrl] = match;
    if (imgUrl) {
      nodes.push(<ChatImage key={key++} src={imgUrl} alt={imgAlt || "Product image"} />);
    } else if (linkUrl) {
      if (isImageUrl(linkUrl)) {
        nodes.push(<ChatImage key={key++} src={linkUrl} alt={linkText || "Product image"} />);
      } else {
        nodes.push(
          <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
            {linkText}
          </a>,
        );
      }
    } else if (bareUrl) {
      if (isImageUrl(bareUrl)) {
        nodes.push(<ChatImage key={key++} src={bareUrl} alt="Product image" />);
      } else {
        nodes.push(
          <a key={key++} href={bareUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
            {bareUrl}
          </a>,
        );
      }
    }
    lastIndex = index + match[0].length;
  }
  pushText(text.slice(lastIndex));

  return nodes;
}

function ChatImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mt-1 block">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URLs from chat, not worth Next/Image domain config for a small thumbnail */}
      <img src={src} alt={alt} className="max-h-[160px] max-w-full rounded-lg border border-neutral-200 object-contain" />
    </a>
  );
}

interface DisplayMessage extends ChatMessage {
  orderPlaced?: OrderPlaced;
  checkoutForm?: CheckoutForm;
}

export interface ChatWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The assistant drawer. Opened from the floating chat launcher in FloatingWidgets. */
export function ChatWidget({ open, onOpenChange }: ChatWidgetProps) {
  const setOpen = onOpenChange;
  const [sessionId, setSessionId] = React.useState("");
  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loadedHistory, setLoadedHistory] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  React.useEffect(() => {
    if (!open || !sessionId || loadedHistory) return;
    setLoadedHistory(true);
    chatApi
      .getHistory(sessionId)
      .then((res) => setMessages(res.messages))
      .catch(() => {
        /* No prior history is a normal first visit - stay on the empty state. */
      });
  }, [open, sessionId, loadedHistory]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !sessionId) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, createdAt: new Date().toISOString() }]);
    setSending(true);

    try {
      const res = await chatApi.sendMessage(sessionId, text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          createdAt: new Date().toISOString(),
          orderPlaced: res.orderPlaced,
          checkoutForm: res.checkoutForm,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong on our end - please try again in a moment.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Drawer open={open} onClose={() => setOpen(false)} side="right" widthClassName="w-[92vw] sm:w-[420px]">
        <div className="flex h-full flex-col">
          <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="-m-1 inline-flex h-[32px] w-[32px] items-center justify-center rounded-sm text-ink hover:bg-neutral-100"
            >
              <X className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <h2 className="flex-1 text-center text-sm font-bold uppercase tracking-[0.2em] text-ink">
              Shopping Assistant
            </h2>
            <span className="h-[32px] w-[32px]" aria-hidden />
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-neutral-500">
                <Bot className="h-[40px] w-[40px] text-neutral-300" aria-hidden />
                <p>Ask me about products, pricing, delivery, or place a cash-on-delivery order right here.</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageBubble key={i} message={m} sessionId={sessionId} onCheckoutClose={() => setOpen(false)} />
              ))
            )}
            {sending ? (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
                Typing…
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-neutral-200 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
              className="h-[40px] flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg bg-accent text-paper disabled:opacity-40"
            >
              <Send className="h-[16px] w-[16px]" aria-hidden />
            </button>
          </form>
        </div>
      </Drawer>
    </>
  );
}

function MessageBubble({
  message,
  sessionId,
  onCheckoutClose,
}: {
  message: DisplayMessage;
  sessionId: string;
  onCheckoutClose: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%] space-y-2">
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-snug",
            isUser ? "bg-ink text-paper" : "bg-neutral-100 text-neutral-800",
          )}
        >
          {renderMessageContent(message.content)}
        </div>
        {message.orderPlaced ? <OrderPlacedCard order={message.orderPlaced} /> : null}
        {message.checkoutForm ? (
          <ChatCheckoutForm form={message.checkoutForm} sessionId={sessionId} onClose={onCheckoutClose} />
        ) : null}
      </div>
    </div>
  );
}

function OrderPlacedCard({ order }: { order: OrderPlaced }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
      <p className="font-bold text-ink">Order confirmed - #{order.orderNumber}</p>
      <p className="text-neutral-600">
        Total {formatPrice(order.total, order.currency)} · Cash on Delivery
      </p>
      <a
        href={order.url}
        className="mt-1 inline-block text-xs font-bold uppercase tracking-wide text-ink underline underline-offset-2"
      >
        View order →
      </a>
    </div>
  );
}

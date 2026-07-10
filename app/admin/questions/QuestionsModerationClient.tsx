"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, Check, EyeOff, HelpCircle, Loader2, Search, ShieldCheck, Store, Trash2, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils/cn";
import { useAdminQuestions, useApproveQuestion, useDeleteAdminQuestion, useHideQuestion } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { COMPANY } from "@/lib/entity/company";
import type { AdminListQuestionsParams, AdminQuestion, AdminQuestionStatus, QuestionAnswer } from "@/types/questions";

const STATUS_OPTIONS: { value: AdminQuestionStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function AnswerLine({ answer }: { answer: QuestionAnswer }) {
  const isPlatform = answer.answeredByRole === "admin" || answer.answeredByRole === "superadmin";
  return (
    <div className="rounded-sm border-l-2 border-accent/30 bg-neutral-50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs">
        {isPlatform ? (
          <span className="inline-flex items-center gap-1 rounded-sm border border-neutral-200 bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
            <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> {COMPANY.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-sm border border-neutral-200 bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
            <Store className="h-2.5 w-2.5" aria-hidden /> Seller
          </span>
        )}
        <span className="font-medium text-ink">{answer.answeredByName}</span>
        <span className="text-neutral-400">·</span>
        <time dateTime={answer.createdAt} className="text-neutral-500">{formatDate(answer.createdAt)}</time>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{answer.text}</p>
    </div>
  );
}

function readProductRef(p: AdminQuestion["product"]): { title: string; slug: string | null } {
  if (!p) return { title: "Unknown product", slug: null };
  if (typeof p === "string") return { title: p, slug: null };
  return { title: p.title, slug: p.slug };
}

function QuestionRow({ question }: { question: AdminQuestion }) {
  const toast = useUIStore((s) => s.toast);
  const approve = useApproveQuestion();
  const hide = useHideQuestion();
  const remove = useDeleteAdminQuestion();
  const busy = approve.isPending || hide.isPending || remove.isPending;
  const product = readProductRef(question.product);

  const onApprove = async () => {
    try {
      await approve.mutateAsync(question._id);
      toast({ title: "Question approved", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't approve", tone: "error" }); }
  };
  const onHide = async () => {
    try {
      await hide.mutateAsync(question._id);
      toast({ title: "Question hidden", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't hide", tone: "error" }); }
  };
  const onDelete = async () => {
    if (!window.confirm("Permanently delete this question? This cannot be undone.")) return;
    try {
      await remove.mutateAsync(question._id);
      toast({ title: "Question deleted", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't delete", tone: "error" }); }
  };

  const statusChip = question.isHidden ? (
    <span className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-200 text-neutral-700">Hidden</span>
  ) : question.isApproved ? (
    <span className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700">Approved</span>
  ) : (
    <span className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700">Pending</span>
  );

  return (
    <article className="flex flex-col gap-3 border-b border-neutral-100 py-4 last:border-b-0">
      <header className="flex items-start gap-3">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-ink">{question.askedByName}</span>
            {statusChip}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
            <span>·</span>
            {product.slug ? (
              <Link href={`/product/${product.slug}#qa`} className="truncate hover:underline" target="_blank" rel="noreferrer">
                {product.title}
              </Link>
            ) : (
              <span className="truncate">{product.title}</span>
            )}
            {question.answers.length > 0 ? (
              <><span>·</span><span>{question.answers.length} {question.answers.length === 1 ? "answer" : "answers"}</span></>
            ) : null}
          </div>
        </div>
      </header>

      <p className="whitespace-pre-line text-sm text-neutral-700">{question.text}</p>

      {question.answers.length > 0 ? (
        <div className="ml-7 flex flex-col gap-2">
          {question.answers.map((a) => <AnswerLine key={a._id} answer={a} />)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {!question.isApproved || question.isHidden ? (
          <Button size="sm" onClick={onApprove} disabled={busy}>
            {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            <span className="ml-1">Approve</span>
          </Button>
        ) : null}
        {!question.isHidden ? (
          <Button size="sm" variant="secondary" onClick={onHide} disabled={busy}>
            {hide.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
            <span className="ml-1">Hide</span>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
          {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          <span className="ml-1">Delete</span>
        </Button>
      </div>
    </article>
  );
}

export function QuestionsModerationClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = (search.get("status") ?? "pending") as AdminQuestionStatus;
  const q = search.get("q") ?? "";
  const product = search.get("product") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(q);
  React.useEffect(() => setQDraft(q), [q]);
  React.useEffect(() => {
    if (qDraft === q) return;
    const t = setTimeout(() => { update({ q: qDraft || undefined }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  const [productDraft, setProductDraft] = React.useState(product);
  React.useEffect(() => setProductDraft(product), [product]);
  React.useEffect(() => {
    if (productDraft === product) return;
    const t = setTimeout(() => { update({ product: productDraft || undefined }); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productDraft]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k); else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const params: AdminListQuestionsParams = React.useMemo(
    () => ({ status, q: q || undefined, product: product || undefined, page, limit: 20 }),
    [status, q, product, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminQuestions(params);
  const questions = data?.data.questions ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = status !== "pending" || Boolean(q) || Boolean(product);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Questions</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Review buyer questions before they hit product pages. Approving a hidden question republishes it; deleting is permanent.</p>
        </div>
        {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Status</span>
          <Select value={status} onChange={(e) => update({ status: e.target.value })} options={STATUS_OPTIONS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <Input placeholder="Question text or asker name" value={qDraft} onChange={(e) => setQDraft(e.target.value)} className="pl-8" />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <Input placeholder="Product ID" value={productDraft} onChange={(e) => setProductDraft(e.target.value)} className="w-36" />
        {filtersActive ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink">
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load questions."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <HelpCircle className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">
            {status === "pending" ? "No pending questions. The queue is clear." : "No questions match these filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-sm border border-neutral-200 bg-paper px-3">
          <ul>
            {questions.map((q) => <li key={q._id}><QuestionRow question={q} /></li>)}
          </ul>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}
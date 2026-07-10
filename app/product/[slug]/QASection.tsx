"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  HelpCircle,
  Loader2,
  ShieldCheck,
  Store,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { COMPANY } from "@/lib/entity/company";
import { z } from "zod";
import { Badge, Button, Input, Label, Spinner } from "@/components/ui";
import { Pagination } from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils/cn";
import {
  useAnswerQuestion,
  useAskQuestion,
  useDeleteAnswer,
  useProductQuestions,
} from "@/hooks/useQuestions";
import { QuestionsError } from "@/lib/api/questions";
import type { Question, QuestionAnswer } from "@/types/questions";

/**
 * Product Q&A - buyer asks, seller (or admin) answers. Sits under the
 * Reviews block on the PDP. The component is composed of four sub-pieces:
 *
 *  1. AskForm - auth-gated input that posts a new question. Disabled if the
 *     viewer is the product owner, since owners can't ask questions on
 *     their own product (caught server-side too).
 *  2. AnswerForm - visible only for the seller-of-product or an admin.
 *     Inline beneath each question so the reply lands in context.
 *  3. QuestionRow - renders text, asker, asked-on date, answers list, and
 *     the conditional reply / delete-answer affordances.
 *  4. Pending banner - when the asker views their own pending question
 *     we surface a "waiting for review" hint so they don't think it got
 *     swallowed.
 *
 * Why we don't share infrastructure with ReviewsSection: the Q&A surface
 * deliberately diverges - no rating distribution, no helpful votes, and the
 * answer thread is part of the row rather than a separate query. Pulling
 * the two into a shared shell would force one to bend.
 */

/* ───────────────────── Forms ───────────────────── */

const questionFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(5, "Question is too short")
    .max(500, "Question is too long"),
});
type QuestionFormValues = z.infer<typeof questionFormSchema>;

const answerFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Answer cannot be empty")
    .max(1000, "Answer is too long"),
});
type AnswerFormValues = z.infer<typeof answerFormSchema>;

interface AskFormProps {
  productId: string;
}

function AskForm({ productId }: AskFormProps) {
  const toast = useUIStore((s) => s.toast);
  const ask = useAskQuestion(productId);

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: { text: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await ask.mutateAsync({ text: values.text });
      toast({
        title: "Question submitted",
        description: "We'll publish it once a moderator approves.",
        tone: "success",
      });
      form.reset({ text: "" });
    } catch (err) {
      const message =
        err instanceof QuestionsError ? err.message : "Couldn't submit question";
      toast({ title: message, tone: "error" });
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-paper p-4"
    >
      <Label htmlFor="qa-ask">Ask a question</Label>
      <Input
        id="qa-ask"
        placeholder="What would you like to know about this product?"
        {...form.register("text")}
      />
      {form.formState.errors.text ? (
        <p className="text-xs text-red-600">{form.formState.errors.text.message}</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          Questions are reviewed before publishing.
        </p>
        <Button type="submit" disabled={ask.isPending}>
          {ask.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Submit
        </Button>
      </div>
    </form>
  );
}

interface AnswerFormProps {
  productId: string;
  questionId: string;
  onDone?: () => void;
}

function AnswerForm({ productId, questionId, onDone }: AnswerFormProps) {
  const toast = useUIStore((s) => s.toast);
  const answer = useAnswerQuestion(productId);

  const form = useForm<AnswerFormValues>({
    resolver: zodResolver(answerFormSchema),
    defaultValues: { text: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await answer.mutateAsync({
        questionId,
        input: { text: values.text },
      });
      toast({ title: "Answer posted", tone: "success" });
      form.reset({ text: "" });
      onDone?.();
    } catch (err) {
      const message =
        err instanceof QuestionsError ? err.message : "Couldn't post answer";
      toast({ title: message, tone: "error" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
      <Label htmlFor={`qa-answer-${questionId}`} className="sr-only">
        Your answer
      </Label>
      <textarea
        id={`qa-answer-${questionId}`}
        rows={3}
        placeholder="Type your reply…"
        className="w-full rounded-lg border border-neutral-300 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-neutral-400 focus:border-ink focus:outline-none"
        {...form.register("text")}
      />
      {form.formState.errors.text ? (
        <p className="text-xs text-red-600">{form.formState.errors.text.message}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={answer.isPending}>
          {answer.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Post answer
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/* ───────────────────── Row ───────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface AnswerBlockProps {
  productId: string;
  questionId: string;
  answer: QuestionAnswer;
  /** True when the viewer can delete this specific answer (author or admin). */
  canDelete: boolean;
}

function AnswerBlock({
  productId,
  questionId,
  answer,
  canDelete,
}: AnswerBlockProps) {
  const toast = useUIStore((s) => s.toast);
  const remove = useDeleteAnswer(productId);

  const isPlatform =
    answer.answeredByRole === "admin" || answer.answeredByRole === "superadmin";

  const onDelete = async () => {
    if (!window.confirm("Delete this answer?")) return;
    try {
      await remove.mutateAsync({ questionId, answerId: answer._id });
      toast({ title: "Answer removed", tone: "success" });
    } catch (err) {
      const message =
        err instanceof QuestionsError ? err.message : "Couldn't remove answer";
      toast({ title: message, tone: "error" });
    }
  };

  return (
    <div className="mt-2 rounded-r-lg border-l-4 border-neutral-300 bg-neutral-50 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs">
        {isPlatform ? (
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {COMPANY.name}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Store className="h-3.5 w-3.5" aria-hidden /> Seller
          </Badge>
        )}
        <span className="font-medium text-ink">{answer.answeredByName}</span>
        <span className="text-neutral-400">·</span>
        <time dateTime={answer.createdAt} className="text-neutral-500">
          {formatDate(answer.createdAt)}
        </time>
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={remove.isPending}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-red-600 disabled:opacity-50"
            aria-label="Delete answer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-neutral-700">
        {answer.text}
      </p>
    </div>
  );
}

interface QuestionRowProps {
  productId: string;
  question: Question;
  /** Current viewer's role on this product - drives the reply affordance. */
  canAnswer: boolean;
  /** Current viewer's id - used to detect "I asked this" (pending banner). */
  viewerId?: string;
  /** Admin viewers can always delete any answer; non-admin author can delete their own. */
  isAdmin: boolean;
}

function QuestionRow({
  productId,
  question,
  canAnswer,
  viewerId,
  isAdmin,
}: QuestionRowProps) {
  const [showReply, setShowReply] = React.useState(false);
  const askedByMe = viewerId === question.askedBy;

  return (
    <article className="flex flex-col border-b border-neutral-100 py-4 last:border-b-0">
      <header className="flex flex-wrap items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <div className="flex flex-1 flex-col gap-1">
          <p className="whitespace-pre-line text-sm font-medium text-ink">{question.text}</p>
          <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
            <span>Asked by {question.askedByName}</span>
            <span>·</span>
            <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
            {askedByMe && !question.isApproved ? (
              <Badge variant="muted" className="ml-0.5">
                Pending review
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      {question.answers.length > 0 ? (
        <div className="ml-6 flex flex-col">
          {question.answers.map((a) => (
            <AnswerBlock
              key={a._id}
              productId={productId}
              questionId={question._id}
              answer={a}
              // Admins can delete any answer; non-admins can delete only
              // their own. Server enforces this too, so a stale UI just
              // gets a polite 403.
              canDelete={isAdmin || (Boolean(viewerId) && a.answeredBy === viewerId)}
            />
          ))}
        </div>
      ) : null}

      {canAnswer ? (
        <div className="ml-6 mt-2">
          {showReply ? (
            <AnswerForm
              productId={productId}
              questionId={question._id}
              onDone={() => setShowReply(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowReply(true)}
              className="text-xs font-medium text-ink underline-offset-2 hover:underline"
            >
              {question.answers.length > 0 ? "Add another answer" : "Reply to this question"}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

/* ───────────────────── Section ───────────────────── */

export interface QASectionProps {
  productId: string;
  /**
   * Owner of the product - used to flip the "Reply" affordance on for the
   * seller themselves. The page passes this from the populated
   * `product.seller` ref; falls back to undefined for products without an
   * explicit owner (legacy data).
   */
  sellerId?: string;
  className?: string;
}

export function QASection({ productId, sellerId, className }: QASectionProps) {
  const { status, data: session } = useSession();
  const isAuthed = status === "authenticated";
  const viewerId = session?.user?.id;
  const viewerRole = session?.user?.role;
  const isAdmin = viewerRole === "admin" || viewerRole === "superadmin";
  const isOwner = Boolean(viewerId && sellerId && viewerId === sellerId);
  const canAnswer = isOwner || isAdmin;
  const pathname = usePathname();

  const [page, setPage] = React.useState(1);
  const listParams = React.useMemo(() => ({ page, limit: 5 }), [page]);
  const listQuery = useProductQuestions(productId, listParams, true);

  const questions = listQuery.data?.data.questions ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <section className={cn("flex flex-col gap-4", className)} id="qa">
      <header className="flex flex-wrap items-end justify-between gap-1">
        <div>
          <h2 className="text-base font-bold text-ink sm:text-xl">Questions & answers</h2>
          <p className="text-sm text-neutral-600">
            Ask the seller anything about this product.
          </p>
        </div>
      </header>

      {/* Ask form / sign-in CTA. Owner can't ask their own product. */}
      {status === "loading" ? (
        <div className="flex items-center justify-center rounded-xl border border-neutral-200 p-4">
          <Spinner />
        </div>
      ) : !isAuthed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-paper p-4">
          <p className="text-sm text-neutral-700">
            Sign in to ask a question about this product.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`${pathname ?? "/"}#qa`)}`}
          >
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      ) : isOwner ? (
        <div className="rounded-xl border border-neutral-200 bg-paper p-4 text-sm text-neutral-700">
          You can't ask a question on your own product, but you can reply to buyer
          questions below as they come in.
        </div>
      ) : (
        <AskForm productId={productId} />
      )}

      {/* List */}
      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Spinner />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-paper py-8 text-center text-sm text-neutral-500">
          No questions yet - be the first to ask.
        </div>
      ) : (
        <ul className="flex flex-col">
          {questions.map((q) => (
            <li key={q._id}>
              <QuestionRow
                productId={productId}
                question={q}
                canAnswer={canAnswer}
                viewerId={viewerId ?? undefined}
                isAdmin={isAdmin}
              />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-2"
        />
      ) : null}
    </section>
  );
}

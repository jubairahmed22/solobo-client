/**
 * Product Q&A - shared types for the storefront PDP block and the admin
 * moderation page. Mirrors the backend's `projectPublicQuestion()` shape on
 * the public surface and the admin list's populated product ref on the
 * moderation surface.
 *
 * Two distinct list shapes:
 *  - `Question` (public): trimmed projection rendered on the PDP. `answers`
 *    inlined - they're always read together with the question and there's
 *    only ever a handful per row, so it'd be wasteful to round-trip again.
 *  - `AdminQuestion` (moderation): same fields plus moderation flags +
 *    populated product ref so the table can deep-link without a second
 *    fetch per row.
 *
 * The asker's id is exposed on the public shape because the PDP UI needs to
 * know whether the current viewer is the asker (to show their own pending
 * question instead of hiding it).
 */

export type AnswerAuthorRole = "seller" | "admin" | "superadmin";

export interface QuestionAnswer {
  _id: string;
  text: string;
  /**
   * Author id - used by the PDP to surface a "delete my own answer"
   * affordance for the answerer. Admins ignore this and can delete any
   * answer.
   */
  answeredBy: string;
  /**
   * Display name frozen at write time. The PDP renders this verbatim so
   * the answer stays readable even if the answerer renames their account.
   */
  answeredByName: string;
  /**
   * Pinned at write time too - distinguishes a seller reply from a
   * platform support reply in the UI.
   */
  answeredByRole: AnswerAuthorRole;
  createdAt: string;
}

/** Public projection - what the PDP receives. */
export interface Question {
  _id: string;
  /** Question body, 5–500 chars. */
  text: string;
  /** Denormalised display name; falls back to email local-part on the backend. */
  askedByName: string;
  /** ObjectId string - used by the UI to detect "this is my pending question". */
  askedBy: string;
  isApproved: boolean;
  answers: QuestionAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface ListProductQuestionsParams {
  page?: number;
  limit?: number;
}

export interface ListProductQuestionsResponse {
  questions: Question[];
}

export interface CreateQuestionInput {
  text: string;
}

export interface AnswerQuestionInput {
  text: string;
}

/* ───────── Admin moderation surface ───────── */

/**
 * Status filter mapping mirrors the backend's `STATUS_FILTER` table:
 *  - pending  = !isApproved && !isHidden
 *  - approved = isApproved && !isHidden
 *  - hidden   = isHidden
 *  - all      = no flag filter
 */
export type AdminQuestionStatus = "all" | "pending" | "approved" | "hidden";

/**
 * Slim populated product reference returned by `populate("product")` on the
 * admin list - just enough to deep-link to the PDP without a second fetch.
 */
export interface AdminQuestionProductRef {
  _id: string;
  title: string;
  slug: string;
}

/**
 * Moderation row. Includes the raw boolean flags rather than a derived
 * status string so the table can render a precise badge ("hidden after
 * approval" vs "pending") and the toggle buttons can know which action is
 * still applicable.
 */
export interface AdminQuestion {
  _id: string;
  text: string;
  askedByName: string;
  askedBy: string;
  isApproved: boolean;
  isHidden: boolean;
  answers: QuestionAnswer[];
  product: AdminQuestionProductRef | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminListQuestionsParams {
  status?: AdminQuestionStatus;
  q?: string;
  product?: string;
  page?: number;
  limit?: number;
}

export interface AdminListQuestionsResponse {
  questions: AdminQuestion[];
}

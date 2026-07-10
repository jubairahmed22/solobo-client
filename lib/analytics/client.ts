/**
 * First-party analytics tracker - universal tracking layer.
 *
 * A single, app-wide tracker (see the exported `analytics` singleton) that:
 *  - SINGLETON: one instance owns all queueing/flush state; the free
 *    functions `track` / `initAnalytics` delegate to it.
 *  - QUEUE-BASED: events buffer in memory AND in localStorage, so a reload or
 *    crash never loses un-shipped events.
 *  - CONSENT-AWARE: nothing leaves the device (neither our endpoint nor the
 *    GTM dataLayer) until consent allows it; a denied user's queue is purged.
 *  - RETRY: failed flushes are re-queued and retried with capped exponential
 *    backoff; the persistent queue is drained on the next page load.
 *  - DEDUPLICATION: every event carries a uuid; a bounded ring buffer of sent
 *    ids + an optional `dedupeKey` window suppress double-sends across reloads
 *    and rapid re-fires.
 *  - GTM-COMPATIBLE: every tracked event is also pushed to `window.dataLayer`
 *    in GTM's `{ event, ... }` shape, so Google Tag Manager / GA4 can consume
 *    the exact same calls with zero extra wiring.
 *
 * Why first-party over a raw pixel: the dashboard's financial + marketing
 * reports JOIN these events against Orders/Coupons/Offers, which a third-party
 * sink can't do without exporting PII off-platform. GTM support is additive.
 */

import { resolveAttribution, type Attribution } from "./attribution";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const COLLECT_URL = `${API_URL}/api/analytics/collect`;

const ANON_KEY = "solobo_anon_id";
const SESSION_KEY = "solobo_session";
const QUEUE_KEY = "solobo_evq"; // persisted pending events
const SENT_KEY = "solobo_evsent"; // persisted ring buffer of sent ids (dedup)
const CONSENT_KEY = "solobo_consent";

const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutes
const MAX_BATCH = 25; // backend caps at 30/beacon; stay under
const FLUSH_DELAY_MS = 4000; // coalesce bursts of events
const MAX_QUEUE = 200; // hard cap so the persistent queue can't grow unbounded
const SENT_RING = 500; // remember the last N sent ids for dedup
const DEDUPE_WINDOW_MS = 2000; // suppress identical dedupeKey within this window
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 2000;
const RETRY_CAP_MS = 60_000;

/** Canonical event names - mirror of the backend ANALYTICS_EVENTS enum. */
export type AnalyticsEventName =
  | "page_view"
  | "product_view"
  | "product_list_view"
  | "search"
  | "add_to_cart"
  | "remove_from_cart"
  | "view_cart"
  | "begin_checkout"
  | "add_payment_info"
  | "purchase"
  | "signup"
  | "login";

export interface TrackPayload {
  path?: string;
  title?: string;
  referrer?: string;
  value?: number;
  currency?: string;
  props?: Record<string, unknown>;
  /**
   * Optional idempotency key. Two events with the same dedupeKey fired within
   * DEDUPE_WINDOW_MS collapse to one (e.g. a product_view double-firing from a
   * remount). Distinct from the per-event uuid, which dedupes across reloads.
   */
  dedupeKey?: string;
}

interface QueuedEvent {
  id: string;
  name: AnalyticsEventName;
  ts: number;
  path?: string;
  title?: string;
  referrer?: string;
  value?: number;
  currency?: string;
  props?: Record<string, unknown>;
}

export type ConsentState = "granted" | "denied" | "pending";

/**
 * Opt-out model by default: first-party, non-PII analytics run under
 * legitimate interest unless the visitor opts out. Flip `consentRequired` (via
 * initAnalytics) to switch to an opt-in model where nothing sends until the
 * visitor explicitly grants consent.
 */
const DEFAULT_CONSENT: ConsentState = "pending";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/* localStorage helpers - every access is guarded (SSR / privacy mode). */
function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked - degrade to in-memory only */
  }
}

/** Read a browser cookie by name (used for the Meta _fbp/_fbc identifiers). */
function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

class Analytics {
  private queue: QueuedEvent[] = [];
  private sentIds: string[] = [];
  private recentKeys = new Map<string, number>();
  private consent: ConsentState = DEFAULT_CONSENT;
  private consentRequired = false;
  private attribution: { first: Attribution; last: Attribution } | null = null;

  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private sending = false;
  private initialized = false;

  /* ── Lifecycle ── */

  init(options: { consentRequired?: boolean } = {}): void {
    if (typeof window === "undefined" || this.initialized) return;
    this.initialized = true;
    this.consentRequired = options.consentRequired ?? false;

    // Restore persisted state: pending queue (for retry), sent-id ring (for
    // dedup), and the visitor's prior consent choice.
    this.queue = this.loadJSON<QueuedEvent[]>(QUEUE_KEY, []);
    this.sentIds = this.loadJSON<string[]>(SENT_KEY, []);
    const storedConsent = lsGet(CONSENT_KEY) as ConsentState | null;
    if (storedConsent === "granted" || storedConsent === "denied") {
      this.consent = storedConsent;
    }

    this.attribution = resolveAttribution();

    // Flush on the page being hidden/closed - last chance to ship the queue.
    const onHide = () => this.flush(true);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush(true);
    });
    // Coming back online is a natural moment to drain anything stuck.
    window.addEventListener("online", () => this.scheduleFlush(0));

    // Drain whatever the previous session left behind.
    if (this.queue.length > 0) this.scheduleFlush(0);
  }

  /* ── Consent ── */

  setConsent(state: ConsentState): void {
    this.consent = state;
    if (state === "granted" || state === "denied") lsSet(CONSENT_KEY, state);
    // Mirror the choice into Google Consent Mode V2 so a single user action
    // updates both our first-party gate and GTM/GA4's storage signals.
    this.syncConsentMode(state);
    // Broadcast so other consent-aware integrations (e.g. Microsoft Clarity)
    // can react live without polling.
    try {
      window.dispatchEvent(new CustomEvent("pm:consent", { detail: state }));
    } catch {
      /* SSR / no CustomEvent - non-fatal */
    }
    if (state === "denied") {
      // Purge everything pending; honour the opt-out immediately.
      this.queue = [];
      this.persistQueue();
    } else if (state === "granted") {
      this.scheduleFlush(0);
    }
  }

  /**
   * Push a Consent Mode V2 `update` for all four signals. We call gtag in its
   * canonical form (a function that pushes its `arguments` object) - a plain
   * `dataLayer.push([...])` is NOT recognised by Google as a consent command.
   * 'pending' is a no-op: the inline default already set denied.
   */
  private syncConsentMode(state: ConsentState): void {
    if (typeof window === "undefined" || state === "pending") return;
    const v: "granted" | "denied" = state === "granted" ? "granted" : "denied";
    try {
      const w = window as unknown as {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
      };
      w.dataLayer = w.dataLayer ?? [];
      const dl = w.dataLayer;
      const gtag =
        typeof w.gtag === "function"
          ? w.gtag
          : function gtagShim() {
              // Canonical gtag form: push the arguments object itself.
              // eslint-disable-next-line prefer-rest-params
              dl.push(arguments);
            };
      gtag("consent", "update", {
        ad_storage: v,
        ad_user_data: v,
        ad_personalization: v,
        analytics_storage: v,
      });
    } catch {
      /* Consent Mode optional - never block first-party tracking on it */
    }
  }

  getConsent(): ConsentState {
    return this.consent;
  }

  /** Whether events may currently leave the device. */
  private canCollect(): boolean {
    if (this.consent === "denied") return false;
    if (this.consentRequired) return this.consent === "granted";
    // Opt-out model: "pending" is treated as allowed.
    return true;
  }

  /* ── Public tracking API ── */

  track(name: AnalyticsEventName, payload: TrackPayload = {}): void {
    if (typeof window === "undefined") return;
    if (!this.initialized) this.init();
    if (this.consent === "denied") return; // hard stop on opt-out

    // dedupeKey suppression - collapse rapid identical re-fires.
    if (payload.dedupeKey) {
      const now = Date.now();
      const last = this.recentKeys.get(payload.dedupeKey);
      if (last && now - last < DEDUPE_WINDOW_MS) return;
      this.recentKeys.set(payload.dedupeKey, now);
      if (this.recentKeys.size > 100) {
        // Prune oldest to keep the map bounded.
        const cutoff = now - DEDUPE_WINDOW_MS;
        for (const [k, t] of this.recentKeys) if (t < cutoff) this.recentKeys.delete(k);
      }
    }

    const id = uuid();
    const path = payload.path ?? window.location.pathname + window.location.search;
    const event: QueuedEvent = {
      id,
      name,
      ts: Date.now(),
      path,
      title: payload.title,
      referrer: payload.referrer,
      value: payload.value,
      currency: payload.currency,
      // Carry the event id in props so the row is traceable server-side and a
      // future server-side dedup can key on it.
      props: { ...(payload.props ?? {}), _eid: id },
    };

    this.enqueue(event);
    // Mirror to GTM/GA4 immediately (consent-gated inside).
    this.pushToDataLayer(name, event);

    if (name === "purchase" || this.queue.length >= MAX_BATCH) {
      this.flush(); // highest-value signal / queue full → ship now
    } else {
      this.scheduleFlush();
    }
  }

  /* ── Queue management ── */

  private enqueue(event: QueuedEvent): void {
    // Dedup: never re-queue an id we've already shipped or already hold.
    if (this.sentIds.includes(event.id)) return;
    if (this.queue.some((e) => e.id === event.id)) return;
    this.queue.push(event);
    // Drop oldest if we blow the cap (protect localStorage + memory).
    if (this.queue.length > MAX_QUEUE) this.queue = this.queue.slice(-MAX_QUEUE);
    this.persistQueue();
  }

  private markSent(ids: string[]): void {
    this.sentIds.push(...ids);
    if (this.sentIds.length > SENT_RING) this.sentIds = this.sentIds.slice(-SENT_RING);
    this.persist(SENT_KEY, this.sentIds);
  }

  private scheduleFlush(delay = FLUSH_DELAY_MS): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delay);
  }

  /**
   * Ship a batch. `viaBeacon` (page-hide path) uses navigator.sendBeacon,
   * which is fire-and-forget - we optimistically mark those sent. The normal
   * path uses fetch+keepalive so we can confirm delivery and RETRY on failure.
   */
  private async flush(viaBeacon = false): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.canCollect()) return; // consent pending(opt-in)/denied → hold
    if (this.queue.length === 0) return;
    if (this.sending && !viaBeacon) return;

    const batch = this.queue.slice(0, MAX_BATCH);
    const ids = batch.map((e) => e.id);
    const attr = this.attribution ?? resolveAttribution();

    // Forward the Meta Pixel cookies in the body - they're set on the
    // storefront origin, so a cross-origin beacon to the API can't read them as
    // cookies. The server uses them for Conversions API matching.
    const fbp = readCookie("_fbp");
    const fbc = readCookie("_fbc");

    // Strip internal `id` from the wire shape (it's preserved in props._eid).
    const body = JSON.stringify({
      anonymousId: this.getAnonymousId(),
      sessionId: this.getSessionId(),
      attribution: attr.first,
      lastTouch: attr.last,
      fbp: fbp || undefined,
      fbc: fbc || undefined,
      events: batch.map(({ id: _omit, ...rest }) => rest),
    });

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // IMPORTANT: text/plain is CORS-safelisted, so the cross-origin POST skips
    // the preflight sendBeacon can't perform. The backend parses JSON
    // regardless of content-type.
    const BEACON_TYPE = "text/plain;charset=UTF-8";

    if (viaBeacon) {
      let ok = false;
      try {
        ok = !!navigator.sendBeacon?.(COLLECT_URL, new Blob([body], { type: BEACON_TYPE }));
      } catch {
        ok = false;
      }
      if (ok) {
        // Optimistically clear - beacons give no delivery signal.
        this.removeFromQueue(ids);
        this.markSent(ids);
      }
      return;
    }

    this.sending = true;
    try {
      const res = await fetch(COLLECT_URL, {
        method: "POST",
        headers: { "Content-Type": BEACON_TYPE },
        body,
        keepalive: true,
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`collect ${res.status}`);
      // Success - confirm delivery, remember ids for dedup, reset backoff.
      this.removeFromQueue(ids);
      this.markSent(ids);
      this.retryAttempt = 0;
      if (this.queue.length > 0) this.scheduleFlush(0);
    } catch {
      // Failure - events stay queued; retry with capped exponential backoff.
      this.scheduleRetry();
    } finally {
      this.sending = false;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.retryAttempt >= MAX_RETRIES) return;
    const delay = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** this.retryAttempt);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, delay);
  }

  private removeFromQueue(ids: string[]): void {
    const set = new Set(ids);
    this.queue = this.queue.filter((e) => !set.has(e.id));
    this.persistQueue();
  }

  /* ── GTM / dataLayer bridge ── */

  private pushToDataLayer(name: AnalyticsEventName, event: QueuedEvent): void {
    if (!this.canCollect()) return;
    try {
      const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
      w.dataLayer = w.dataLayer ?? [];
      w.dataLayer.push({
        event: name,
        event_id: event.id,
        page_path: event.path,
        value: event.value,
        currency: event.currency,
        ...event.props,
      });
    } catch {
      /* dataLayer optional - never block first-party tracking on GTM */
    }
  }

  /* ── Identity ── */

  private getAnonymousId(): string {
    let id = lsGet(ANON_KEY);
    if (!id) {
      id = uuid();
      lsSet(ANON_KEY, id);
    }
    return id;
  }

  private getSessionId(): string {
    const now = Date.now();
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      const parsed = raw ? (JSON.parse(raw) as { id: string; last: number }) : null;
      if (parsed && now - parsed.last < SESSION_IDLE_MS) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, last: now }));
        return parsed.id;
      }
      const id = uuid();
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
      return id;
    } catch {
      return uuid();
    }
  }

  /* ── Persistence ── */

  private persistQueue(): void {
    this.persist(QUEUE_KEY, this.queue);
  }
  private persist(key: string, value: unknown): void {
    lsSet(key, JSON.stringify(value));
  }
  private loadJSON<T>(key: string, fallback: T): T {
    const raw = lsGet(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}

/** The app-wide singleton. Import the free helpers below rather than this. */
export const analytics = new Analytics();

/* Thin free-function facade - preserves the existing call sites. */
export function initAnalytics(options?: { consentRequired?: boolean }): void {
  analytics.init(options);
}
export function track(name: AnalyticsEventName, payload?: TrackPayload): void {
  analytics.track(name, payload);
}
export function setAnalyticsConsent(state: ConsentState): void {
  analytics.setConsent(state);
}
export function getAnalyticsConsent(): ConsentState {
  return analytics.getConsent();
}

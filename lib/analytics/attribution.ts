/**
 * Attribution capture - first-touch + last-touch.
 *
 * On the visitor's very first page we snapshot where they came from (UTM
 * params if present, else the external referrer) and persist it as the
 * FIRST-TOUCH attribution. It never changes for the life of the device id.
 * Every subsequent visit that carries fresh campaign params updates the
 * LAST-TOUCH snapshot. Both ride along on every event so the backend can run
 * first- or last-touch attribution reports without replaying sessions.
 *
 * Storage is localStorage (survives sessions). Everything degrades to a plain
 * "direct" attribution when storage is unavailable (SSR, privacy mode).
 */

const FIRST_TOUCH_KEY = "solobo_attr_first";
const LAST_TOUCH_KEY = "solobo_attr_last";
/** Mirror of {first,last} written as a cookie so the server can read it too. */
const ATTR_COOKIE = "solobo_attr";
const ATTR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  // Ad-platform click identifiers - matched by the platforms' server APIs.
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  msclkid?: string;
  referrer?: string;
  landingPage?: string;
}

function readJSON(key: string): Attribution | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: Attribution): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked - attribution silently degrades */
  }
}

/** Pull a UTM/campaign snapshot from the current URL, if any params exist. */
function parseUrlAttribution(): Attribution | null {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k)?.trim() || undefined;

  // Ad-platform click ids imply a paid click even without explicit utm params.
  const gclid = get("gclid");
  const fbclid = get("fbclid");
  const ttclid = get("ttclid");
  const msclkid = get("msclkid");
  const anyClick = gclid || fbclid || ttclid || msclkid;

  // Infer source/medium from a click id when utm_* is missing, so paid clicks
  // are never miscredited as "direct".
  const inferredSource = gclid
    ? "google"
    : fbclid
      ? "facebook"
      : ttclid
        ? "tiktok"
        : msclkid
          ? "bing"
          : undefined;

  const utm: Attribution = {
    source: get("utm_source") ?? inferredSource,
    medium: get("utm_medium") ?? (anyClick ? "cpc" : undefined),
    campaign: get("utm_campaign"),
    term: get("utm_term"),
    content: get("utm_content"),
    gclid,
    fbclid,
    ttclid,
    msclkid,
  };

  const hasAny = Object.values(utm).some(Boolean);
  if (!hasAny) return null;
  return utm;
}

/** Classify the external referrer host into a coarse source when no UTM. */
function referrerAttribution(): Attribution | null {
  const ref = document.referrer;
  if (!ref) return null;
  try {
    const url = new URL(ref);
    // Same-origin referrers are internal navigation, not acquisition.
    if (url.hostname === window.location.hostname) return null;
    return { source: url.hostname, medium: "referral", referrer: ref };
  } catch {
    return null;
  }
}

/**
 * Resolve and persist attribution for the current page load. Returns the
 * { first, last } pair the tracker attaches to every beacon.
 */
export function resolveAttribution(): { first: Attribution; last: Attribution } {
  if (typeof window === "undefined") return { first: {}, last: {} };

  const landingPage = window.location.pathname + window.location.search;
  const fresh = parseUrlAttribution() ?? referrerAttribution();

  const existingFirst = readJSON(FIRST_TOUCH_KEY);
  let first = existingFirst;
  if (!first) {
    // No prior first-touch - this load establishes it.
    first = fresh
      ? { ...fresh, referrer: document.referrer || undefined, landingPage }
      : { source: "direct", medium: "none", landingPage };
    writeJSON(FIRST_TOUCH_KEY, first);
  }

  // Update last-touch only when this load carries new campaign signal.
  let last = readJSON(LAST_TOUCH_KEY) ?? first;
  if (fresh) {
    last = { ...fresh, referrer: document.referrer || undefined, landingPage };
    writeJSON(LAST_TOUCH_KEY, last);
  }

  // Mirror to a first-party cookie so the server can read attribution on
  // same-site requests without the client having to forward it in every body.
  writeAttrCookie({ first, last });

  return { first, last };
}

/** Persist {first,last} to a readable first-party cookie. */
function writeAttrCookie(value: { first: Attribution; last: Attribution }): void {
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    // SameSite=Lax keeps it on top-level same-site navigations; not HttpOnly so
    // the client can read it back, and so it's small enough to ride requests.
    document.cookie = `${ATTR_COOKIE}=${encoded}; Max-Age=${ATTR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  } catch {
    /* cookie blocked - localStorage copy still works */
  }
}

/** Read a cookie value by name. */
function readCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m?.[1] ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GA4 client id, parsed from the `_ga` cookie ("GA1.1.<id1>.<id2>" → the
 * "<id1>.<id2>" tail). Captured so a server-side GA4 Measurement Protocol
 * purchase fired from a payment webhook joins the buyer's web session.
 */
export function getGaClientId(): string | undefined {
  const ga = readCookie("_ga");
  if (!ga) return undefined;
  const parts = ga.split(".");
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : undefined;
}

/** Meta Pixel cookies, forwarded so server-side CAPI can match the user. */
export function getFbCookies(): { fbp?: string; fbc?: string } {
  return { fbp: readCookie("_fbp"), fbc: readCookie("_fbc") };
}

/**
 * The attribution payload the checkout sends to the backend, which persists it
 * on the Order (and merges onto the User). Pulls the resolved first/last touch
 * plus the analytics cookie ids the server can't read cross-origin.
 */
export interface CheckoutAttribution {
  firstTouch: Attribution;
  lastTouch: Attribution;
  gaClientId?: string;
  fbp?: string;
  fbc?: string;
}

export function getCheckoutAttribution(): CheckoutAttribution {
  const { first, last } = resolveAttribution();
  const { fbp, fbc } = getFbCookies();
  return { firstTouch: first, lastTouch: last, gaClientId: getGaClientId(), fbp, fbc };
}

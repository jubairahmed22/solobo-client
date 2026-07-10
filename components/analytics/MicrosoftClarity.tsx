"use client";

import * as React from "react";
import Script from "next/script";
import { getAnalyticsConsent, type ConsentState } from "@/lib/analytics";

/**
 * Microsoft Clarity - session intelligence (heatmaps + session recordings).
 *
 * Three requirements, all satisfied here:
 *  - ENVIRONMENT CONTROLLED: only loads when NEXT_PUBLIC_CLARITY_ID is set, so
 *    it's off in dev/preview unless explicitly configured.
 *  - LAZY LOADED: next/script `lazyOnload` - Clarity is non-critical, so it
 *    loads during browser idle after the page is interactive and never competes
 *    with first paint or the checkout path.
 *  - CONSENT AWARE: the tag is not injected at all while consent is "denied".
 *    When it does load, we relay the consent signal to Clarity's own API
 *    (`clarity('consent')` granted/denied) so its cookies obey the same choice.
 *    It reacts live to the `pm:consent` event the tracker emits, so a
 *    consent-banner click updates Clarity without a reload.
 */

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

type ClarityFn = (...args: unknown[]) => void;

export function MicrosoftClarity() {
  const [consent, setConsent] = React.useState<ConsentState>("pending");

  // Initialise from stored consent on mount, then track live changes.
  React.useEffect(() => {
    setConsent(getAnalyticsConsent());
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      if (detail) setConsent(detail);
    };
    window.addEventListener("pm:consent", onConsent);
    return () => window.removeEventListener("pm:consent", onConsent);
  }, []);

  // Relay the consent signal to Clarity's own API once it has loaded.
  React.useEffect(() => {
    if (consent === "pending") return;
    const clarity = (window as unknown as { clarity?: ClarityFn }).clarity;
    if (typeof clarity === "function") {
      clarity("consent", consent === "granted");
    }
  }, [consent]);

  // Env-controlled: nothing to do without an id. Consent-aware: never inject
  // the tag while the visitor has opted out.
  if (!CLARITY_ID || consent === "denied") return null;

  return (
    <Script id="ms-clarity" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script","${CLARITY_ID}");`}
    </Script>
  );
}

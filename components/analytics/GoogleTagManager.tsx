import Script from "next/script";

/**
 * Google Tag Manager + GA4 with Consent Mode V2.
 *
 * Loading order is the whole game here, and it is enforced via next/script
 * strategies:
 *
 *  1. `beforeInteractive` - an inline script that bootstraps the dataLayer +
 *     gtag shim and sets the Consent Mode V2 DEFAULTS (all four signals denied,
 *     with `wait_for_update`). Per Google's spec these defaults MUST execute
 *     before the GTM/GA library so no tag can fire or set a cookie until the
 *     visitor's choice is known. beforeInteractive runs before any Next.js
 *     framework code or hydration, so this is guaranteed.
 *
 *  2. `afterInteractive` - the GTM container itself (or a direct GA4 gtag.js
 *     loader as a fallback when only a GA measurement id is configured). By the
 *     time this runs, the consent defaults are already in the dataLayer.
 *
 * The four V2 signals are all supported:
 *   analytics_storage · ad_storage · ad_user_data · ad_personalization
 *
 * Runtime consent changes are pushed by the first-party tracker
 * (lib/analytics setConsent → gtag('consent','update', …)), so a single
 * consent action updates both Google's Consent Mode and our own collection.
 *
 * Configure via env: NEXT_PUBLIC_GTM_ID (preferred - host GA4 inside the
 * container) or NEXT_PUBLIC_GA_ID (direct GA4 fallback).
 */

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Consent Mode V2 defaults. Denied-by-default is the privacy-safe baseline;
 * Google's tags then operate in cookieless "ping" mode until an explicit
 * `update` grants storage. We also honour a returning visitor's previously
 * stored choice (solobo_consent) immediately so consented users aren't
 * needlessly throttled on the first page. `wait_for_update` gives a late
 * consent banner a 500ms window before tags decide.
 */
const CONSENT_DEFAULT = `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('consent','default',{
  'ad_storage':'denied',
  'ad_user_data':'denied',
  'ad_personalization':'denied',
  'analytics_storage':'denied',
  'wait_for_update': 500
});
try {
  if (localStorage.getItem('solobo_consent') === 'granted') {
    gtag('consent','update',{
      'ad_storage':'granted',
      'ad_user_data':'granted',
      'ad_personalization':'granted',
      'analytics_storage':'granted'
    });
  }
} catch (e) {}
gtag('js', new Date());
`;

export function GoogleTagManager() {
  // Nothing configured - render nothing (no empty containers, no console noise).
  if (!GTM_ID && !GA_ID) return null;

  return (
    <>
      {/* 1) Consent Mode V2 defaults - runs before GTM/GA (beforeInteractive). */}
      <Script
        id="consent-mode-default"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT }}
      />

      {GTM_ID ? (
        <>
          {/* 2a) GTM container (afterInteractive). GA4 is configured as a tag
              inside this container; its analytics_storage consent gates it. */}
          <Script
            id="gtm-container"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
          {/* GTM <noscript> fallback - belongs at the top of <body>. */}
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="gtm"
            />
          </noscript>
        </>
      ) : GA_ID ? (
        <>
          {/* 2b) Direct GA4 fallback when no GTM container is configured. */}
          <Script
            id="ga4-lib"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: `gtag('config','${GA_ID}');` }}
          />
        </>
      ) : null}
    </>
  );
}

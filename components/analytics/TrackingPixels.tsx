import Script from "next/script";

/**
 * Server component - fetches the site's integration keys from the public API
 * and renders the appropriate tracking scripts. Runs on every page as part of
 * the root layout. Results are revalidated every 5 minutes so a key change
 * reaches the storefront without a deploy.
 *
 * Script loading order:
 *  1. Consent Mode defaults (beforeInteractive, via GoogleTagManager)
 *  2. GTM container (afterInteractive) - supersedes standalone GA4/Ads tags
 *     when a GTM ID is configured.
 *  3. All other pixels (afterInteractive) - Meta, TikTok, Snapchat, Pinterest,
 *     Twitter/X, Hotjar, direct GA4 (fallback), Google Ads (fallback).
 */

interface Integrations {
  gtmId?: string;
  ga4Id?: string;
  googleAdsId?: string;
  googleAdsLabel?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  pinterestTagId?: string;
  twitterPixelId?: string;
  hotjarSiteId?: string;
}

async function fetchIntegrations(): Promise<Integrations> {
  try {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
    const res = await fetch(`${apiBase}/site-settings`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    const json = await res.json();
    return (json?.data?.integrations as Integrations) ?? {};
  } catch {
    return {};
  }
}

export async function TrackingPixels() {
  const i = await fetchIntegrations();

  // GTM overrides the standalone GA4 and Google Ads scripts - if GTM is
  // configured those tags should live inside the container, not here.
  const hasGtm = Boolean(i.gtmId);

  return (
    <>
      {/* ── Google Tag Manager ── */}
      {hasGtm ? (
        <Script
          id="gtm-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${i.gtmId}');`,
          }}
        />
      ) : null}

      {/* ── GA4 direct (only when GTM is absent) ── */}
      {!hasGtm && i.ga4Id ? (
        <>
          <Script
            id="ga4-db-lib"
            src={`https://www.googletagmanager.com/gtag/js?id=${i.ga4Id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-db-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${i.ga4Id}');`,
            }}
          />
        </>
      ) : null}

      {/* ── Google Ads conversion (only when GTM is absent) ── */}
      {!hasGtm && i.googleAdsId ? (
        <Script
          id="gads-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${i.googleAdsId}');`,
          }}
        />
      ) : null}

      {/* ── Meta Pixel ── */}
      {i.metaPixelId ? (
        <Script
          id="meta-pixel-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${i.metaPixelId}');
fbq('track','PageView');`,
          }}
        />
      ) : null}

      {/* ── TikTok Pixel ── */}
      {i.tiktokPixelId ? (
        <Script
          id="tiktok-pixel-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${i.tiktokPixelId}');ttq.page();}(window,document,'ttq');`,
          }}
        />
      ) : null}

      {/* ── Snapchat Pixel ── */}
      {i.snapchatPixelId ? (
        <Script
          id="snapchat-pixel-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${i.snapchatPixelId}');snaptr('track','PAGE_VIEW');`,
          }}
        />
      ) : null}

      {/* ── Pinterest Tag ── */}
      {i.pinterestTagId ? (
        <Script
          id="pinterest-tag-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${i.pinterestTagId}');pintrk('page');`,
          }}
        />
      ) : null}

      {/* ── Twitter / X Pixel ── */}
      {i.twitterPixelId ? (
        <Script
          id="twitter-pixel-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments)},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${i.twitterPixelId}');`,
          }}
        />
      ) : null}

      {/* ── Hotjar ── */}
      {i.hotjarSiteId ? (
        <Script
          id="hotjar-db"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${i.hotjarSiteId},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
          }}
        />
      ) : null}
    </>
  );
}

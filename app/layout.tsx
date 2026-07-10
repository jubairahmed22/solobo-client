import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/seo";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { TrackingPixels } from "@/components/analytics/TrackingPixels";
import { FloatingWidgets } from "@/components/layout";
import { COMPANY } from "@/lib/entity/company";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${COMPANY.name} - Performance Sportswear & Casualwear`,
    template: `%s · ${COMPANY.name}`,
  },
  description:
    "Shop performance sportswear, casualwear and activewear. Built for every level - gym, street and everything in between. Fast delivery nationwide.",
  keywords: [
    "sportswear bangladesh",
    "gym wear",
    "activewear",
    "casual wear",
    "performance clothing",
    "gym clothes dhaka",
    "running wear",
    "workout clothes",
  ],
  applicationName: COMPANY.name,
  authors: [{ name: COMPANY.name }],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_BD",
    url: siteUrl,
    siteName: COMPANY.name,
    title: `${COMPANY.name} - Performance Sportswear & Casualwear`,
    description:
      "Performance sportswear and casualwear engineered for every level.",
  },
  twitter: {
    card: "summary_large_image",
    title: COMPANY.name,
    description: "Performance sportswear & casualwear.",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body>
        <GoogleTagManager />
        <TrackingPixels />
        <Providers>
          {children}
          <FloatingWidgets />
        </Providers>
        <OrganizationJsonLd
          url={siteUrl}
          logo={`${siteUrl}/icon.png`}
          sameAs={[
            "https://facebook.com/solobobd",
            "https://instagram.com/solobobd",
          ]}
          contact={{ contactType: "customer service", areaServed: "BD" }}
        />
        <WebsiteJsonLd url={siteUrl} />
      </body>
    </html>
  );
}

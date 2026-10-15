// @ts-check
/**
 * Next.js config. Must be .js or .mjs — Next 14 doesn't load a .ts config.
 *
 * The previous file was next.config.ts and was rejected at boot ("Configuring
 * Next.js via 'next.config.ts' is not supported"). The JSDoc type-import below
 * keeps editor IntelliSense without requiring a TypeScript loader.
 *
 * @type {import("next").NextConfig}
 */
// Uploaded images are served by the backend under /uploads.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    // Serve images exactly as uploaded — the Next.js optimizer was
    // re-encoding originals to AVIF/WebP at ~75% quality, which visibly
    // degraded product photos. Originals go straight to the browser.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: /** @type {"http" | "https"} */ (apiUrl.protocol.replace(":", "")),
        hostname: apiUrl.hostname,
        ...(apiUrl.port ? { port: apiUrl.port } : {}),
        pathname: "/uploads/**",
      },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
    ],
    // Cache optimized images for a day rather than a minute — product imagery
    // is effectively immutable (upload URLs are unique per file), so
    // re-optimizing every 60s wasted CPU and slowed repeat LCP.
    minimumCacheTTL: 86400,
  },

  experimental: {
    // recharts was dropped from package.json — keep only the packages we
    // actually depend on so Next's optimizePackageImports doesn't try to
    // resolve a phantom.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

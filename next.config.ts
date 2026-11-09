import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    // Report-only until the market UI is audited against it; enforcing can break
    // Next inline scripts and the x402 payment flow.
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://t0.gstatic.com",
      "font-src 'self' data:",
      "connect-src 'self' https://sepolia.base.org https://facilitator.payai.network",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      // Tailwind for plain stylesheets only. The glob matches by file name, so
      // without this exclusion it would also swallow *.module.css and re-type
      // it as plain CSS, dropping the exported class-name mapping.
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        condition: { not: { path: "**/*.module.css" } },
      },
    },
  },
};

export default nextConfig;

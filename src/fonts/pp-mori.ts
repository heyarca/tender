import localFont from "next/font/local";

/**
 * PP Mori, the Tender typeface. Apply `ppMori.variable` on a root element and
 * reference `var(--font-pp-mori)` in a font stack. Weights: 375 (Book),
 * 400 (Regular), and 600 (Semibold).
 */
export const ppMori = localFont({
  src: [
    { path: "./pp-mori/PPMori-Book.woff2", weight: "375", style: "normal" },
    { path: "./pp-mori/PPMori-Regular.woff2", weight: "400", style: "normal" },
    { path: "./pp-mori/PPMori-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-pp-mori",
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

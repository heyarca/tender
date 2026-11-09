import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { ppMori } from "@/fonts/pp-mori";
import { AppProviders } from "@/components/market/page/app-providers";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tender.heyarca.app"),
  title: {
    default: "Tender — The execution market for APIs",
    template: "%s · Tender",
  },
  description:
    "Providers compete to serve your API requests on price, latency, freshness, and reliability.",
  openGraph: {
    title: "Tender — The execution market for APIs",
    description:
      "Providers compete to serve your API requests on price, latency, freshness, and reliability.",
    siteName: "Tender",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ppMori.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

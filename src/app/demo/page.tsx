import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TenderLogo } from "@/components/shell/tender-logo";
import { ProviderLogo } from "@/components/ui/provider-logo";

export const metadata: Metadata = {
  title: "Demo",
  description: "Watch Tender route API requests to the provider that meets your policy.",
};

/** `/demo`: the product video, full width. */
export default function DemoPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Tender home" className="text-foreground">
          <TenderLogo />
        </Link>
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          by
          <ProviderLogo src="/providers/arca-labs.png" name="Arca Labs" size={20} />
          <span className="font-medium text-foreground">Arca Labs</span>
        </span>
      </header>
      <video
        className="aspect-video w-full rounded-lg border border-border bg-foreground"
        src="/demo.mp4"
        controls
        playsInline
        preload="metadata"
      />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 self-start text-button font-medium text-accent-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to Tender
      </Link>
    </main>
  );
}

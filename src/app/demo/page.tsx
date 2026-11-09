import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SimpleHeader } from "@/components/market/page/simple-header";
import { PageContainer } from "@/components/shell/page-container";

const TITLE = "Make APIs compete for your traffic";

export const metadata: Metadata = {
  title: `Tender demo — ${TITLE}`,
  description: "Watch Tender route each request to the API provider that meets your requirements.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return (
    <>
      <SimpleHeader />
      <PageContainer className="pt-12 pb-16">
        <div className="mx-auto max-w-5xl text-center">
          <h1>{TITLE}</h1>
          <video
            className="mt-8 w-full rounded-lg border border-border bg-black"
            controls
            playsInline
            preload="metadata"
            poster="/demo/tender-demo-poster.jpg"
            src="/demo/tender-demo.mp4"
          />
          <Link
            href="/landing"
            className="mt-6 inline-flex items-center gap-1.5 text-body font-medium text-accent-foreground"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden /> Back to Tender
          </Link>
        </div>
      </PageContainer>
    </>
  );
}

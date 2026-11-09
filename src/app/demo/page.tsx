import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SimpleHeader } from "@/components/market/page/simple-header";
import { cn } from "@/lib/utils";
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
            src="/demo.mp4"
          />
          <Link
            href="/landing"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8")}
          >
            Try it at tender.heyarca.app <ArrowRight aria-hidden />
          </Link>
        </div>
      </PageContainer>
    </>
  );
}

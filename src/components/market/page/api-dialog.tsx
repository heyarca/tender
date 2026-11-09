"use client";

import { ArrowUpRight, CircleDollarSign } from "lucide-react";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Dialog, DialogBody, DialogClose, DialogContent } from "@/components/ui/dialog";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { focusSection } from "@/components/market/market-ui";
import { format, getApiSnippets, getResponseJson, type MarketView } from "@/lib/tender";
import { afterDialogClose } from "./after-dialog-close";
import { buildCurlSnippet, contractPath, marketPath, settlementQuote } from "./api-snippets";

type SnippetTab = "curl" | "typescript" | "python" | "response";

const TABS: { value: SnippetTab; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "response", label: "Response" },
];

const noopSubscribe = () => () => {};

/** Origin of the current page, for copy-paste-ready snippets. */
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "http://localhost:3000",
  );
}

export interface ApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: MarketView;
}

/**
 * API dialog: cURL / TypeScript / Python with the current policy, the latest response, and the
 * paid-request flow (x402: 402 challenge, signed USDC retry on Base Sepolia).
 */
export function ApiDialog({ open, onOpenChange, view }: ApiDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title={`API · ${view.definition.name}`}
        description="One normalized contract. These requests use your current routing policy."
        footer={
          <>
            <Button
              variant="outline"
              className="sm:mr-auto"
              onClick={() => {
                onOpenChange(false);
                afterDialogClose(() => focusSection("payments"));
              }}
            >
              <CircleDollarSign aria-hidden />
              Pay with USDC in the console
            </Button>
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-button font-medium text-muted-foreground no-underline transition-colors duration-quick hover:bg-accent-subtle hover:text-accent-foreground focus-visible:shadow-focus focus-visible:outline-none"
            >
              OpenAPI
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
            <DialogClose render={<Button variant="primary" />}>Done</DialogClose>
          </>
        }
      >
        <DialogBody className="flex flex-col gap-5">
          <ApiSnippets view={view} />
          <PaidRequestFlow view={view} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ApiSnippets({ view }: { view: MarketView }) {
  const [tab, setTab] = useState<SnippetTab>("curl");
  const origin = useOrigin();
  const { definition, policy, lastResult } = view;

  const snippets = useMemo(() => getApiSnippets(definition, policy), [definition, policy]);
  const code = useMemo(() => {
    switch (tab) {
      case "curl":
        return buildCurlSnippet(origin, definition.id, policy);
      case "typescript":
        return snippets.find((sample) => sample.language === "typescript")?.code ?? "";
      case "python":
        return snippets.find((sample) => sample.language === "python")?.code ?? "";
      case "response":
        return lastResult ? getResponseJson(definition, lastResult) : definition.sampleResponse;
    }
  }, [tab, origin, definition, policy, snippets, lastResult]);

  const language =
    tab === "response"
      ? lastResult
        ? `JSON · ${lastResult.requestId}`
        : "JSON · example"
      : TABS.find((item) => item.value === tab)?.label;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">GET</span>
          <code className="truncate font-mono text-[12px]">{contractPath(definition.id)}</code>
        </div>
        <SegmentedControl aria-label="Code sample" items={TABS} value={tab} onValueChange={setTab} />
      </div>
      <CodeBlock code={code} language={language} preClassName="max-h-72 overflow-y-auto" />
    </div>
  );
}

function PaidRequestFlow({ view }: { view: MarketView }) {
  const active = view.route.activeProvider;
  const quote = active ? settlementQuote(active.conditions.bidPrice) : null;
  return (
    <section aria-labelledby="paid-requests-title" className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
      <div>
        <h3 id="paid-requests-title" className="text-sm font-medium text-foreground">
          Paid requests
        </h3>
        <p className="mt-0.5 text-caption leading-snug text-muted-foreground">
          Contract calls are paid per request in USDC with x402, on Base Sepolia (testnet).
        </p>
      </div>
      <ol className="grid gap-2 text-body text-foreground md:grid-cols-3">
        <FlowStep step={1} title="Request">
          <code className="font-mono text-[12px]">GET</code> the contract without payment. It returns{" "}
          <span className="font-medium">402 Payment Required</span> with a <code className="font-mono text-[12px]">PAYMENT-REQUIRED</code> quote.
        </FlowStep>
        <FlowStep step={2} title="Sign and retry">
          Sign the USDC authorization with an x402 client and retry with{" "}
          <code className="font-mono text-[12px]">PAYMENT-SIGNATURE</code>.
        </FlowStep>
        <FlowStep step={3} title="Settle">
          Tender serves the result and pays the winning provider.{" "}
          <code className="font-mono text-[12px]">PAYMENT-RESPONSE</code> holds the transaction hash.
        </FlowStep>
      </ol>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card px-3 py-2.5 text-caption text-muted-foreground">
        {active && quote ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <ProviderLogo src={active.logo} name={active.name} size={16} />
              {active.name}
            </span>
            <span className="tabular-nums">
              Bid <span className="text-foreground">{format.priceWithUnit(active.conditions.bidPrice)}</span> ={" "}
              <span className="text-foreground">{format.cost(quote.priceUsd)}</span> per request
            </span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <span className="tabular-nums">
              Settles <span className="text-foreground">{quote.settledUsd.toFixed(6)} USDC</span> ({quote.settledAtomic} atomic{" "}
              {quote.settledAtomic === 1 ? "unit" : "units"})
            </span>
            {quote.rounded ? <span className="w-full">Rounded up to the USDC minimum unit (0.000001).</span> : null}
          </>
        ) : (
          <span className="text-negative-text">No eligible provider: the contract returns 409 before any payment.</span>
        )}
      </div>
      <ul className="grid gap-1 text-caption text-muted-foreground sm:grid-cols-2">
        <EndpointRow path="/api/v1/markets" note="Both markets and default policies" />
        <EndpointRow path={marketPath(view.id)} note="Bids, performance, and route" />
        <EndpointRow path={contractPath(view.id).split("?")[0]} note="Normalized result (x402)" />
        <EndpointRow path="/api/v1/openapi.json" note="OpenAPI 3.1 document" />
      </ul>
    </section>
  );
}

function FlowStep({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 text-caption font-medium text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground tabular-nums">
          {step}
        </span>
        {title}
      </div>
      <p className="mt-1.5 text-caption leading-relaxed text-foreground">{children}</p>
    </li>
  );
}

function EndpointRow({ path, note }: { path: string; note: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className="rounded-sm bg-muted px-1.5 py-px font-mono text-[11px] font-medium text-foreground">GET</span>
      <code className="truncate font-mono text-[12px] text-foreground">{path}</code>
      <span className="truncate">{note}</span>
    </li>
  );
}

import { ArrowUpRight, CircleCheck, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { formatMicros } from "@/components/credits/money";
import { PayoutStatusBadge } from "@/components/payouts/payout-status-badge";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { describePolicy } from "@/lib/agent/policy";
import { AUTO_TOP_UP_MICROS } from "@/lib/ledger/auto-top-up";
import { getProvider } from "@/lib/registry";
import { evaluateMarket, format, getDefaultPolicy, getMarketDefinition } from "@/lib/tender";
import { ButtonLink } from "./LandingButton";
import { SectionHeader } from "./SectionHeader";
import { landingStyles as styles } from "./styles";

const MARKET_ID = "sf-weather";
/** A request like Ask Tender's first starter prompt, and the routing policy it sets for it. */
const PROMPT = "Cheapest SF weather under $30 per million requests, P95 under 300 ms. Spend at most $5 this week.";
const ASK_POLICY = { maxPrice: 30, maxP95LatencyMs: 300 };
const WEEKLY_LIMIT_MICROS = 5_000_000;
const TOP_UP_MICROS = 10_000_000;
/** Ask Tender runs three requests unless the user asks for more. */
const ASK_REQUESTS = 3;

/** The first PayPal Payouts batch Tender sent; PayPal reported it and every item as SUCCESS. */
const PAYOUT_BATCH = {
  id: "BHNKZWVBBGSMG",
  status: "SUCCESS",
  items: [
    { providerId: "arca-labs", amountMicros: 10_000 },
    { providerId: "fernline", amountMicros: 10_000 },
    { providerId: "the-zone-bio", amountMicros: 10_000 },
  ],
} as const;

/** The provider that wins San Francisco Weather under Ask Tender's policy, from the real engine and fixtures. */
function weatherWinner() {
  const definition = getMarketDefinition(MARKET_ID);
  const policy = { ...getDefaultPolicy(MARKET_ID), ...ASK_POLICY };
  const fixtures = definition.providers;
  const evaluation = evaluateMarket(
    fixtures.map(({ id, name, defaults }) => ({ id, name, conditions: defaults })),
    policy,
  );
  const winner = fixtures.find((fixture) => fixture.id === evaluation.recommendedId) ?? fixtures[0];
  // A bid of $X per million requests costs X micro-USD per request, rounded up.
  return { market: definition.name, name: winner.name, logo: winner.logo, bid: winner.defaults.bidPrice, chargeMicros: Math.ceil(winner.defaults.bidPrice) };
}

function Stage({ children }: { children: ReactNode }) {
  return <div className={`${styles.payStage} ${styles.marketStageGrid}`} aria-hidden="true">{children}</div>;
}

/** Account balance after a PayPal top-up and the first paid request, with the top-up toast. */
function AddFundsFigure({ winner }: { winner: ReturnType<typeof weatherWinner> }) {
  const rows = [
    { kind: "Top-up", tone: "positive" as const, details: "PayPal", logo: null, amount: formatMicros(TOP_UP_MICROS, { signed: true }) },
    { kind: "Charge", tone: "neutral" as const, details: winner.name, logo: winner.logo, amount: formatMicros(-winner.chargeMicros) },
  ];
  return (
    <Stage>
      <div className={`${styles.payFloat} ${styles.productUi}`}>
        <div className="flex items-start gap-2.5">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-body leading-snug font-medium text-foreground">Added {formatMicros(TOP_UP_MICROS)}</p>
            <p className="text-body leading-snug text-muted-foreground">Balance {formatMicros(TOP_UP_MICROS)}</p>
          </div>
        </div>
      </div>
      <div className={`${styles.payWindow} ${styles.productUi}`}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Available</p>
            <p className="mt-1 text-[28px] leading-none font-medium tracking-[-0.02em] text-foreground tabular-nums">
              {formatMicros(TOP_UP_MICROS - winner.chargeMicros)}
            </p>
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-primary-border bg-primary px-2.5 text-button font-medium text-primary-foreground [&_svg]:size-4">
            <Plus />
            Add funds
          </span>
        </div>
        <ul className="mt-4 border-t border-border">
          {rows.map((row) => (
            <li key={row.kind} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0 last:pb-0">
              <Badge tone={row.tone}>{row.kind}</Badge>
              {row.logo ? <ProviderLogo src={row.logo} name={row.details} size={16} /> : null}
              <span className="min-w-0 flex-1 truncate text-foreground">{row.details}</span>
              <span className="shrink-0 font-medium text-foreground tabular-nums">{row.amount}</span>
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
}

function ActivityRow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-caption leading-snug text-muted-foreground">
      <CircleCheck className="mt-px size-3.5 shrink-0 text-primary-strong" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** The Ask Tender panel after the first starter prompt: policy set, limit approved, requests paid. */
function AskTenderFigure({ winner }: { winner: ReturnType<typeof weatherWinner> }) {
  const policy = describePolicy(MARKET_ID, ASK_POLICY);
  return (
    <Stage>
      <div className={`${styles.payWindow} ${styles.payChat} ${styles.productUi}`}>
        <p className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="size-4 text-primary-strong" />
          <span className="text-base font-semibold text-foreground">Ask Tender</span>
        </p>
        <div className={`${styles.payChatBody} flex flex-col gap-3 p-4`}>
          <p className="ml-auto max-w-[88%] rounded-lg bg-muted px-3 py-2 text-body leading-snug text-foreground">{PROMPT}</p>
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
            <p className="flex items-center gap-2 text-body font-medium text-foreground">
              <CircleCheck className="size-4 text-primary-strong" />
              Spending limit approved
            </p>
            <dl className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-4 text-caption">
                <dt className="text-muted-foreground">Weekly limit</dt>
                <dd className="font-medium text-foreground tabular-nums">{formatMicros(WEEKLY_LIMIT_MICROS)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 text-caption">
                <dt className="text-muted-foreground">Market</dt>
                <dd className="truncate font-medium text-foreground">{winner.market}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 text-caption">
                <dt className="shrink-0 text-muted-foreground">Policy</dt>
                <dd className="min-w-0 text-right font-medium text-foreground">{policy}</dd>
              </div>
            </dl>
            <p className="flex items-center gap-2 text-caption font-medium text-primary-strong">
              <CircleCheck className="size-3.5" />
              PayPal saved for automatic top-ups
            </p>
          </div>
          <ActivityRow>
            Topped up {formatMicros(AUTO_TOP_UP_MICROS)} automatically with your saved PayPal. Ran {ASK_REQUESTS} requests on {winner.market}:{" "}
            {formatMicros(winner.chargeMicros * ASK_REQUESTS)} charged to credits
          </ActivityRow>
        </div>
      </div>
    </Stage>
  );
}

/** The winning bid above Tender's first PayPal Payouts batch. */
function PayoutsFigure({ winner }: { winner: ReturnType<typeof weatherWinner> }) {
  const total = PAYOUT_BATCH.items.reduce((sum, item) => sum + item.amountMicros, 0);
  return (
    <Stage>
      <div className={`${styles.payFloat} ${styles.payBid} ${styles.productUi}`}>
        <ProviderLogo src={winner.logo} name={winner.name} size={24} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-foreground">{winner.name}</span>
          <span className="text-caption text-muted-foreground">Winning bid</span>
        </span>
        <span className="ml-auto shrink-0 text-foreground tabular-nums">
          {format.price(winner.bid)}
          <span className="text-muted-foreground"> {format.priceUnit}</span>
        </span>
      </div>
      <div className={`${styles.payWindow} ${styles.productUi}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">PayPal Payouts batch</p>
            <p className="truncate font-mono text-caption text-foreground">{PAYOUT_BATCH.id}</p>
          </div>
          <PayoutStatusBadge status={PAYOUT_BATCH.status} />
        </div>
        <ul className="mt-3 border-t border-border">
          {PAYOUT_BATCH.items.map((item) => {
            const provider = getProvider(item.providerId);
            const name = provider?.name ?? item.providerId;
            return (
              <li key={item.providerId} className="flex items-center gap-2.5 border-b border-border py-2.5">
                <ProviderLogo src={provider?.logo} name={name} size={20} />
                <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
                <span className="shrink-0 text-foreground tabular-nums">{formatMicros(item.amountMicros)}</span>
                <PayoutStatusBadge status="SUCCESS" />
              </li>
            );
          })}
        </ul>
        <p className="flex items-baseline justify-between gap-3 pt-2.5">
          <span className="text-muted-foreground">Paid with PayPal</span>
          <span className="font-medium text-foreground tabular-nums">{formatMicros(total)}</span>
        </p>
      </div>
    </Stage>
  );
}

/** #paypal: how money moves, from PayPal credits to agent spending to provider payouts. */
export function PaySection() {
  const winner = weatherWinner();
  const steps = [
    {
      title: ["Add funds", "with PayPal."],
      body: `Pay with PayPal Checkout and get Tender credits. Each request costs the winning provider’s bid, for example ${format.requestCost(winner.bid)}.`,
      figure: <AddFundsFigure winner={winner} />,
    },
    {
      title: ["Ask Tender", "spends for you."],
      body: "Tell it what your app needs. It sets your routing policy and spends within a weekly limit you approve. With PayPal saved once, it tops up by itself.",
      figure: <AskTenderFigure winner={winner} />,
    },
    {
      title: ["Providers get", "paid with PayPal."],
      body: "Bidding agents reprice each provider’s bid between 70% and 150% of its listed bid and explain why. Tender pays the winners with PayPal Payouts.",
      figure: <PayoutsFigure winner={winner} />,
    },
  ];
  return (
    <section id="paypal" className={styles.section} aria-labelledby="paypal-title">
      <div className={styles.container}>
        <SectionHeader
          titleId="paypal-title"
          title={
            <>
              <span className={styles.payTitleLine}>Pay with PayPal.</span>{" "}
              <span className={styles.payTitleLine}>Let an agent spend for you.</span>
            </>
          }
          lead="Add credits with PayPal, or let Ask Tender run your requests within a weekly limit you approve. It tops up from your saved PayPal and can send PayPal invoices. Providers get paid with PayPal Payouts."
        />
        <ol className={styles.payGrid}>
          {steps.map((step, index) => (
            <li key={step.title[0]} className={`${styles.card} ${styles.payCard}`}>
              <div className={styles.payCopy}>
                <span className={styles.payStepNumber} aria-hidden="true">{index + 1}</span>
                <h3 className={styles.payHeading}>
                  <span>{step.title[0]}</span> <span>{step.title[1]}</span>
                </h3>
                <p className={styles.payText}>{step.body}</p>
              </div>
              {step.figure}
            </li>
          ))}
        </ol>
        <div className={styles.payActions}>
          <ButtonLink href="/markets/sf-weather?ask=1" size="lg" icon={<Sparkles size={20} />} iconPosition="start">
            Try Ask Tender
          </ButtonLink>
          <ButtonLink href="/account" variant="secondary" size="lg" icon={<ArrowUpRight size={20} />}>
            Add funds
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

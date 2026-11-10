"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/market/payments/payment-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { applyBalance, setAddFundsOpen, useCreditsStore } from "./credits-store";
import { formatMicros, TOP_UP_OPTIONS } from "./money";
import { PayPalButton } from "./paypal-button";

type Phase =
  | { kind: "choose" }
  | { kind: "paying" }
  | { kind: "capturing" }
  | { kind: "paid"; amountMicros: number; balanceMicros: number }
  | { kind: "canceled" }
  | { kind: "error"; message: string };

const AMOUNT_ITEMS = TOP_UP_OPTIONS.map((micros) => ({ value: String(micros), label: formatMicros(micros).replace(/\.00$/, "") }));

/**
 * "Add funds": pick $5, $10, or $20 and pay with PayPal. The balance updates as soon as
 * PayPal completes the capture. Mount it once per page; open it with `setAddFundsOpen(true)`.
 */
export function AddFundsDialog() {
  const open = useCreditsStore((state) => state.addFundsOpen);
  return (
    <Dialog open={open} onOpenChange={setAddFundsOpen}>
      <DialogContent size="sm" title="Add funds" description="Pay with PayPal. Each request you run with credits costs the winning bid.">
        {open ? <AddFundsBody /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddFundsBody() {
  const balanceMicros = useCreditsStore((state) => state.balanceMicros);
  const [amount, setAmount] = useState<string>(String(TOP_UP_OPTIONS[1]));
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const amountMicros = Number(amount);
  const busy = phase.kind === "paying" || phase.kind === "capturing";

  if (phase.kind === "paid") {
    return (
      <DialogBody className="flex flex-col items-center gap-3 pt-2 text-center" data-slot="add-funds-success">
        <CircleCheck aria-hidden="true" className="size-8 text-positive" strokeWidth={1.75} />
        <div>
          <p className="text-base font-medium text-foreground">Added {formatMicros(phase.amountMicros)}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            Your balance is <span className="tabular-nums text-foreground">{formatMicros(phase.balanceMicros)}</span>.
          </p>
        </div>
        <Button variant="primary" className="mt-1 w-full" onClick={() => setAddFundsOpen(false)}>
          Done
        </Button>
      </DialogBody>
    );
  }

  return (
    <DialogBody className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id="add-funds-amount" className="text-xs font-medium text-foreground">
          Amount
        </span>
        <SegmentedControl
          aria-labelledby="add-funds-amount"
          items={AMOUNT_ITEMS}
          value={amount}
          onValueChange={setAmount}
          size="md"
          fullWidth
          disabled={busy}
        />
        <p className="text-caption text-muted-foreground">
          Balance after payment: <span className="tabular-nums text-foreground">{formatMicros(balanceMicros + amountMicros)}</span>
        </p>
      </div>

      <div className="relative">
        <div className={phase.kind === "capturing" ? "invisible" : undefined}>
          <PayPalButton
            amountMicros={amountMicros}
            onStart={() => setPhase({ kind: "paying" })}
            onCapturing={() => setPhase({ kind: "capturing" })}
            onPaid={(result) => {
              applyBalance(result.balanceMicros);
              setPhase({ kind: "paid", ...result });
            }}
            onCancel={() => setPhase({ kind: "canceled" })}
            onError={(message) => setPhase({ kind: "error", message })}
          />
        </div>
        {phase.kind === "capturing" ? (
          <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-body text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            Confirming your payment…
          </p>
        ) : null}
      </div>

      {phase.kind === "canceled" ? <Notice>Payment canceled. Nothing was charged.</Notice> : null}
      {phase.kind === "error" ? (
        <Notice role="alert" tone="negative" icon={<CircleAlert aria-hidden="true" />}>
          {phase.message}
        </Notice>
      ) : null}
    </DialogBody>
  );
}

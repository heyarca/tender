"use client";

import { Wallet } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { refreshAccount, setAddFundsOpen, useCreditsStore } from "./credits-store";
import { formatMicros } from "./money";

/** Credits balance for the top navigation: "$10.00" (links to the account page), or "Add funds". */
export function BalanceChip() {
  const status = useCreditsStore((state) => state.status);
  const balanceMicros = useCreditsStore((state) => state.balanceMicros);

  useEffect(() => {
    if (useCreditsStore.getState().status === "idle") void refreshAccount();
  }, []);

  if (status === "idle" || status === "loading") return <Skeleton className="h-8 w-24" />;
  if (balanceMicros > 0) {
    return (
      <ButtonLink href="/account" variant="outline" aria-label={`Credits balance ${formatMicros(balanceMicros)}. Open account`} data-slot="balance-chip">
        <Wallet aria-hidden="true" />
        <span className="tabular-nums">{formatMicros(balanceMicros)}</span>
      </ButtonLink>
    );
  }
  return (
    <Button variant="outline" onClick={() => setAddFundsOpen(true)} data-slot="balance-chip">
      <Wallet aria-hidden="true" />
      <span className="max-sm:sr-only">Add funds</span>
    </Button>
  );
}

"use client";

import { KeyRound, Plus, Receipt, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Notice, RelativeTime } from "@/components/market/payments/payment-ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { CopyButton } from "@/components/ui/copy-button";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { getMarketSpec, getProvider } from "@/lib/registry";
import type { ApiKeyView, CreatedApiKeyView, LedgerEntryView, LedgerKind, Actor } from "@/lib/ledger/types";
import { getProviderFixture, isMarketId } from "@/lib/tender";
import { cn } from "@/lib/utils";
import { AddFundsDialog } from "./add-funds-dialog";
import { AgentAutopayCard } from "./agent-autopay-card";
import { errorMessage, refreshAccount, setAddFundsOpen, useCreditsStore } from "./credits-store";
import { formatMicros } from "./money";
import { StartOverButton } from "./start-over-button";

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 43;

const KIND: Record<LedgerKind, { label: string; tone: BadgeTone }> = {
  topup: { label: "Top-up", tone: "positive" },
  charge: { label: "Charge", tone: "neutral" },
  refund: { label: "Refund", tone: "info" },
  adjustment: { label: "Adjustment", tone: "neutral" },
};

const ACTOR: Record<Actor, string> = { user: "You", api_key: "API key", agent: "Agent", system: "Tender" };

const absoluteTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

type EntryCell = CustomCellRendererProps<LedgerEntryView>;

function TimeCell({ data }: EntryCell) {
  if (!data) return null;
  return (
    <span title={absoluteTime(data.created_at)}>
      <RelativeTime at={Date.parse(data.created_at)} />
    </span>
  );
}

function TypeCell({ data }: EntryCell) {
  if (!data) return null;
  const kind = KIND[data.kind];
  return <Badge tone={kind.tone}>{kind.label}</Badge>;
}

function DetailsCell({ data }: EntryCell) {
  if (!data) return null;
  if (data.kind === "topup") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-foreground">{data.auto_top_up ? "Auto top-up by Ask Tender" : "PayPal"}</span>
        {data.paypal_capture_id ? <span className="truncate font-mono text-caption text-muted-foreground">{data.paypal_capture_id}</span> : null}
      </span>
    );
  }
  const market = data.market_id ? getMarketSpec(data.market_id) : undefined;
  const fixture = data.market_id && data.provider_id && isMarketId(data.market_id) ? getProviderFixture(data.market_id, data.provider_id) : undefined;
  const providerName = fixture?.name ?? (data.provider_id ? (getProvider(data.provider_id)?.name ?? data.provider_id) : null);
  return (
    <span className="flex min-w-0 items-center gap-2">
      {providerName ? <ProviderLogo src={fixture?.logo ?? null} name={providerName} size={16} /> : null}
      <span className="truncate text-foreground">{providerName ?? "—"}</span>
      {market ? <span className="truncate text-caption text-muted-foreground">{market.name}</span> : null}
    </span>
  );
}

function ActorCell({ data }: EntryCell) {
  return data ? <span>{ACTOR[data.actor]}</span> : null;
}

function AmountCell({ data }: EntryCell) {
  if (!data) return null;
  return (
    <span className={cn("tabular-nums", data.amount_micros > 0 ? "text-positive-text" : "text-foreground")}>
      {formatMicros(data.amount_micros, { signed: true })}
    </span>
  );
}

function BalanceCell({ data }: EntryCell) {
  return data ? <span className="text-foreground tabular-nums">{formatMicros(data.balance_after_micros)}</span> : null;
}

const ENTRY_COLUMNS: DataGridColumn<LedgerEntryView>[] = [
  { colId: "time", headerName: "Time", cellRenderer: TimeCell },
  { colId: "type", headerName: "Type", cellRenderer: TypeCell },
  { colId: "details", headerName: "Details", cellRenderer: DetailsCell, flex: 1, minWidth: 200 },
  { colId: "actor", headerName: "By", cellRenderer: ActorCell },
  { colId: "amount", headerName: "Amount", align: "right", cellRenderer: AmountCell },
  { colId: "balance", headerName: "Balance", align: "right", cellRenderer: BalanceCell },
];

/** Account page: balance, Add funds, transactions, API keys, and Start over. */
export function AccountView() {
  const status = useCreditsStore((state) => state.status);
  const balanceMicros = useCreditsStore((state) => state.balanceMicros);
  const revision = useCreditsStore((state) => state.revision);
  const generation = useCreditsStore((state) => state.generation);

  useEffect(() => {
    void refreshAccount();
  }, []);

  return (
    <>
      <div className="mb-8">
        <h1>Account</h1>
        <p className="mt-1 text-body text-muted-foreground">Your Tender credits, transactions, and API keys.</p>
      </div>

      <Section id="balance" icon={<Wallet aria-hidden="true" />} title="Balance" description="Credits pay for requests at the winning bid. Add funds with PayPal.">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-caption text-muted-foreground">Available</p>
            {status === "ready" ? (
              <p className="mt-1 text-[32px] leading-none font-medium tracking-[-0.02em] text-foreground tabular-nums" data-slot="account-balance">
                {formatMicros(balanceMicros)}
              </p>
            ) : status === "error" ? (
              <p className="mt-1 text-body text-negative-text">The balance could not be loaded. Reload the page to try again.</p>
            ) : (
              <Skeleton className="mt-1 h-8 w-36" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StartOverButton />
            <Button variant="primary" onClick={() => setAddFundsOpen(true)}>
              <Plus aria-hidden="true" />
              Add funds
            </Button>
          </div>
        </div>
      </Section>

      <AgentAutopayCard key={generation} />
      <Transactions revision={revision} />
      <ApiKeys key={generation} />
      <AddFundsDialog />
    </>
  );
}

function Transactions({ revision }: { revision: number }) {
  const [entries, setEntries] = useState<LedgerEntryView[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger?limit=200", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ entries: LedgerEntryView[] }>) : Promise.reject(new Error())))
      .then((body) => {
        if (!cancelled) {
          setEntries(body.entries);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return (
    <Section
      id="transactions"
      icon={<Receipt aria-hidden="true" />}
      title="Transactions"
      description="Top-ups and the requests your balance paid for, newest first."
      framed={false}
      actions={entries && entries.length > 0 ? <span className="text-caption text-muted-foreground tabular-nums">{entries.length} shown</span> : null}
    >
      {failed ? (
        <Notice tone="negative">Transactions could not be loaded. Reload the page to try again.</Notice>
      ) : entries === null ? (
        <Skeleton className="h-32 w-full" />
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState
            icon={<Receipt aria-hidden="true" />}
            title="No transactions yet"
            description="Add funds, then run a request with credits from any market."
            className="py-8"
          />
        </div>
      ) : (
        <DataGrid<LedgerEntryView>
          aria-label="Transactions"
          data-slot="transactions"
          rowData={entries}
          columnDefs={ENTRY_COLUMNS}
          getRowId={(entry) => entry.id}
          reserveHeight={`${HEADER_HEIGHT + entries.length * ROW_HEIGHT + 2}px`}
        />
      )}
    </Section>
  );
}

type KeyCell = CustomCellRendererProps<ApiKeyView> & { onRevoke: (key: ApiKeyView) => void; revoking: string | null };

function KeyNameCell({ data }: KeyCell) {
  return data ? <span className="text-foreground">{data.label ?? "Untitled key"}</span> : null;
}

function KeyPrefixCell({ data }: KeyCell) {
  return data ? <span className="font-mono text-caption text-foreground">tk_{data.prefix}…</span> : null;
}

function KeyCreatedCell({ data }: KeyCell) {
  return data ? <RelativeTime at={Date.parse(data.created_at)} /> : null;
}

function KeyUsedCell({ data }: KeyCell) {
  if (!data) return null;
  return data.last_used_at ? <RelativeTime at={Date.parse(data.last_used_at)} /> : <span>Never</span>;
}

function KeyRevokeCell({ data, onRevoke, revoking }: KeyCell) {
  if (!data) return null;
  return (
    <span data-grid-ignore-click="">
      <Button variant="destructive-outline" size="sm" onClick={() => onRevoke(data)} disabled={revoking === data.id}>
        {revoking === data.id ? "Revoking…" : "Revoke"}
      </Button>
    </span>
  );
}

function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyView[] | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ key: CreatedApiKeyView; origin: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ keys: ApiKeyView[] }>) : Promise.reject(new Error())))
      .then((body) => {
        if (!cancelled) setKeys(body.keys);
      })
      .catch(() => {
        if (!cancelled) setKeys((current) => current ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(label.trim() ? { label: label.trim() } : {}),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not create the key. Try again."));
      const key = (await response.json()) as CreatedApiKeyView;
      setCreated({ key, origin: window.location.origin });
      setLabel("");
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the key. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = useCallback(
    async (key: ApiKeyView) => {
      setRevoking(key.id);
      try {
        const response = await fetch(`/api/keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await errorMessage(response, "Could not revoke the key."));
        setCreated((current) => (current?.key.id === key.id ? null : current));
        toast({ title: "Key revoked", description: `${key.label ?? "Untitled key"} (tk_${key.prefix}…) no longer works.` });
        reload();
      } catch (cause) {
        toast({ tone: "negative", title: cause instanceof Error ? cause.message : "Could not revoke the key." });
      } finally {
        setRevoking(null);
      }
    },
    [reload],
  );

  const columns = useMemo<DataGridColumn<ApiKeyView>[]>(() => {
    const params = { onRevoke: revoke, revoking };
    return [
      { colId: "name", headerName: "Name", cellRenderer: KeyNameCell, cellRendererParams: params, flex: 1, minWidth: 160 },
      { colId: "key", headerName: "Key", cellRenderer: KeyPrefixCell, cellRendererParams: params },
      { colId: "created", headerName: "Created", cellRenderer: KeyCreatedCell, cellRendererParams: params },
      { colId: "used", headerName: "Last used", cellRenderer: KeyUsedCell, cellRendererParams: params },
      { colId: "revoke", headerName: "Actions", headerHidden: true, align: "right", cellRenderer: KeyRevokeCell, cellRendererParams: params },
    ];
  }, [revoke, revoking]);

  return (
    <Section
      id="api-keys"
      icon={<KeyRound aria-hidden="true" />}
      title="API keys"
      description="Requests with a key pay with this balance. Use a key with the SDK, the MCP server, or any HTTP client."
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Input
            aria-label="Key name"
            placeholder="Key name (optional)"
            value={label}
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
            className="w-64 max-w-full"
          />
          <Button type="submit" variant="outline" disabled={creating}>
            <Plus aria-hidden="true" />
            {creating ? "Creating…" : "Create key"}
          </Button>
        </form>
        {error ? <Notice tone="negative">{error}</Notice> : null}

        {created ? (
          <div className="flex flex-col gap-3 rounded-lg border border-primary-strong/40 bg-accent-subtle p-4" data-slot="new-api-key">
            <div>
              <p className="text-sm font-medium text-foreground">Copy your new key now</p>
              <p className="mt-0.5 text-caption text-muted-foreground">You will not see it again. Store it like a password.</p>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card py-1.5 pr-1.5 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{created.key.secret}</code>
              <CopyButton value={created.key.secret} label="Copy API key" />
            </div>
            <CodeBlock
              language="cURL"
              wrap
              code={`curl -H "Authorization: Bearer ${created.key.secret}" \\\n  "${created.origin}/api/v1/weather/current?location=san-francisco"`}
            />
          </div>
        ) : null}

        {keys === null ? (
          <Skeleton className="h-24 w-full" />
        ) : keys.length === 0 ? (
          <p className="text-caption text-muted-foreground">No API keys yet.</p>
        ) : (
          <DataGrid<ApiKeyView>
            aria-label="API keys"
            data-slot="api-keys"
            rowData={keys}
            columnDefs={columns}
            getRowId={(key) => key.id}
            reserveHeight={`${HEADER_HEIGHT + keys.length * ROW_HEIGHT + 2}px`}
          />
        )}
      </div>
    </Section>
  );
}

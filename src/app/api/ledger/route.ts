import { listLedger } from "@/lib/ledger";
import { accountJson, entryView, readAccount } from "@/lib/ledger/http";

/** Ledger entries of the account, newest first. `?limit=` 1..500 (default 100). */
export async function GET(request: Request) {
  const account = await readAccount(request);
  if (account instanceof Response) return account;
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const entries = account ? await listLedger(account.accountId, Number.isFinite(limit) ? limit : 100) : [];
  return accountJson({ entries: entries.map(entryView) });
}

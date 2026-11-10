import { getAccount, listLedger } from "@/lib/ledger";
import { accountJson, accountView, entryView, readAccount } from "@/lib/ledger/http";
import type { AccountResponse } from "@/lib/ledger";

/** Balance, mandate, and the last 20 ledger entries. Never creates an account. */
export async function GET(request: Request) {
  const account = await readAccount(request);
  if (account instanceof Response) return account;
  if (!account) return accountJson({ ...accountView(null), ledger: [] } satisfies AccountResponse);
  const [summary, ledger] = await Promise.all([getAccount(account.accountId), listLedger(account.accountId, 20)]);
  return accountJson({ ...accountView(summary), ledger: ledger.map(entryView) } satisfies AccountResponse);
}

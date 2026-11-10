import { accountCookie, newAccountId } from "@/lib/ledger";
import { accountJson, accountView, requireJson } from "@/lib/ledger/http";
import type { AccountResponse } from "@/lib/ledger";

/** "Start over": a fresh account cookie. The old account's rows stay in the database. */
export async function POST(request: Request) {
  const unsupported = requireJson(request);
  if (unsupported) return unsupported;
  return accountJson({ ...accountView(null), ledger: [] } satisfies AccountResponse, 200, accountCookie(newAccountId()));
}

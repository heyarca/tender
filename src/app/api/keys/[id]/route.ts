import { revokeApiKey } from "@/lib/ledger";
import { accountError, accountJson, readAccount } from "@/lib/ledger/http";

/** Revokes one API key of the account. */
export async function DELETE(request: Request, context: RouteContext<"/api/keys/[id]">) {
  const { id } = await context.params;
  const account = await readAccount(request);
  if (account instanceof Response) return account;
  if (!account || !(await revokeApiKey(account.accountId, id))) return accountError(404, "key_not_found", "No such API key");
  return accountJson({ id, revoked: true });
}

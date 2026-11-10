import { createApiKey, listApiKeys } from "@/lib/ledger";
import { accountError, accountJson, apiKeyView, readAccount, readJsonObject, requireJson, writeAccount } from "@/lib/ledger/http";
import type { CreatedApiKeyView } from "@/lib/ledger";

/** Active API keys of the account (prefix and label only). */
export async function GET(request: Request) {
  const account = await readAccount(request);
  if (account instanceof Response) return account;
  const keys = account ? await listApiKeys(account.accountId) : [];
  return accountJson({ keys: keys.map(apiKeyView) });
}

/** Creates an API key, `{ label? }`. The secret is in this response only. */
export async function POST(request: Request) {
  const unsupported = requireJson(request);
  if (unsupported) return unsupported;
  let label: string | undefined;
  try {
    const body = await readJsonObject(request);
    if (body.label !== undefined && typeof body.label !== "string") throw new Error("label must be a string");
    label = body.label as string | undefined;
  } catch (error) {
    return accountError(400, "invalid_request", error instanceof Error ? error.message : "Invalid request");
  }
  const account = await writeAccount(request);
  if (account instanceof Response) return account;
  const key = await createApiKey(account.accountId, label);
  const created: CreatedApiKeyView = {
    id: key.id,
    prefix: key.prefix,
    label: key.label,
    created_at: key.createdAt,
    last_used_at: null,
    secret: key.secret,
  };
  return accountJson(created, 201, account.setCookie);
}

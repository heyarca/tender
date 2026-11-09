import { LIVE_MARKETS, runLive, type LiveMarketId } from "@/lib/server/live";
import { LIVE_DEFAULTS } from "@/lib/server/live-defaults";
import { readPolicyOverrides } from "@/lib/server/policy";
import { errorResponse, json, preflight } from "@/lib/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ market: string }> }) {
  try {
    const { market } = await params;
    if (!(market in LIVE_MARKETS)) return json({ error: { code: "unknown_market", message: `Live markets: ${Object.keys(LIVE_MARKETS).join(", ")}` } }, 404);
    const id = market as LiveMarketId;
    const policy = { ...LIVE_DEFAULTS[id], ...readPolicyOverrides(request) };
    if (policy.mode.kind === "pinned" && !LIVE_MARKETS[id].providers.some((p) => p.id === (policy.mode as { providerId: string }).providerId))
      return json({ error: { code: "invalid_policy", message: "Invalid pin" } }, 400);
    return json(await runLive(id, policy));
  } catch (error) {
    return errorResponse(error);
  }
}
export const OPTIONS = preflight;

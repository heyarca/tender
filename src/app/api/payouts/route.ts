import { connection } from "next/server";
import { listPayoutBatches, listUnpaidEarnings, refreshOpenBatches } from "@/lib/paypal/payouts";

const headers = { "Cache-Control": "private, no-store" };

/** Payout batches with items, and unpaid earnings per provider. Refreshes batches that are not final. */
export async function GET() {
  await connection();
  await refreshOpenBatches();
  const [batches, earnings] = await Promise.all([listPayoutBatches(), listUnpaidEarnings()]);
  return Response.json({ batches, earnings }, { headers });
}

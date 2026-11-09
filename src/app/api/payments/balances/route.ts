import { connection } from "next/server";
import { readBalances } from "@/lib/payments/wallet";

export async function GET() {
  await connection();
  try {
    return Response.json(await readBalances(), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Unable to read Base Sepolia USDC balances" }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}

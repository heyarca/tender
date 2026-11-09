import { redirect } from "next/navigation";
import { DEFAULT_MARKET_ID } from "@/lib/tender";

/** `/markets` opens the default market. */
export default function MarketsIndex() {
  redirect(`/markets/${DEFAULT_MARKET_ID}`);
}

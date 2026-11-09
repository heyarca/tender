import { redirect } from "next/navigation";
import { DEFAULT_MARKET_ID } from "@/lib/tender";

/** `/` opens the default market. */
export default function Home() {
  redirect(`/markets/${DEFAULT_MARKET_ID}`);
}

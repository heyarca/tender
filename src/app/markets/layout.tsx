import { MarketsFrame } from "@/components/market/page/markets-frame";

/**
 * The market page renders here, above the `[market]` segment, so both markets share one
 * mounted tree. With Cache Components, Next keeps a previous route mounted but hidden
 * (`<Activity>`), which would put two copies of every section id (`#providers`, …) in the
 * document. Switching markets therefore only swaps the `marketId` prop, which is instant
 * and keeps scroll-spy, anchors, and `focusSection` pointing at the visible page.
 * The `[market]` page validates the id and sets the metadata.
 */
export default function MarketsLayout({ children }: LayoutProps<"/markets">) {
  return <MarketsFrame>{children}</MarketsFrame>;
}

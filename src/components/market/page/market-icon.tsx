import { Bitcoin, Cloud, Coins, Euro, PoundSterling, type LucideIcon, type LucideProps } from "lucide-react";
import type { MarketIcon as MarketIconKind } from "@/lib/tender";
import { cn } from "@/lib/utils";

const ICON_TONE: Record<MarketIconKind, string> = {
  cloud: "text-info",
  bitcoin: "text-tier-ultrafast",
  coins: "text-tier-priority",
  euro: "text-positive-text",
  pound: "text-tier-flex",
};

const ICONS: Record<MarketIconKind, LucideIcon> = {
  cloud: Cloud,
  bitcoin: Bitcoin,
  coins: Coins,
  euro: Euro,
  pound: PoundSterling,
};

export interface MarketGlyphProps extends Omit<LucideProps, "ref"> {
  icon: MarketIconKind;
  /** Use the market's accent color (blue cloud, orange bitcoin). Default true. */
  tinted?: boolean;
}

/** Lucide icon of a market: a cloud for weather, the bitcoin sign for BTC/USD, coins for other crypto, the currency sign for FX. */
export function MarketGlyph({ icon, tinted = true, className, ...props }: MarketGlyphProps) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden className={cn(tinted && ICON_TONE[icon], className)} strokeWidth={2} {...props} />;
}

/** 28px circle with the market icon, like OpenRouter's model favicon. */
export function MarketIconCircle({ icon, className }: { icon: MarketIconKind; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background p-1",
        className,
      )}
    >
      <MarketGlyph icon={icon} className="size-4" />
    </span>
  );
}

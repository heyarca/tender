import {
  BadgeCheck,
  Bitcoin,
  Building,
  ChartLine,
  Cloud,
  Coins,
  Cpu,
  Euro,
  FileSearch,
  ImageIcon,
  Languages,
  Layers,
  MapPin,
  MessageSquare,
  Mic,
  Network,
  Package,
  Pickaxe,
  Plane,
  PoundSterling,
  Route,
  Search,
  ShieldCheck,
  Ship,
  Trophy,
  Volume2,
  Wind,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { getCategory, getMarketSpec } from "@/lib/registry";
import { cn } from "@/lib/utils";

/** Registry icon names (kebab-case lucide names) to static lucide components. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  cloud: Cloud,
  wind: Wind,
  cpu: Cpu,
  pickaxe: Pickaxe,
  "chart-line": ChartLine,
  euro: Euro,
  pound: PoundSterling,
  bitcoin: Bitcoin,
  coins: Coins,
  plane: Plane,
  ship: Ship,
  package: Package,
  route: Route,
  "map-pin": MapPin,
  "message-square": MessageSquare,
  layers: Layers,
  mic: Mic,
  "volume-2": Volume2,
  image: ImageIcon,
  languages: Languages,
  "file-search": FileSearch,
  network: Network,
  "badge-check": BadgeCheck,
  "shield-check": ShieldCheck,
  building: Building,
  search: Search,
  trophy: Trophy,
};

/** Accent color per icon (design tokens only). Unknown icons stay muted. */
const ICON_TONE: Readonly<Record<string, string>> = {
  cloud: "text-info",
  wind: "text-info",
  cpu: "text-accent-foreground",
  pickaxe: "text-tier-priority",
  "chart-line": "text-info",
  euro: "text-positive-text",
  pound: "text-tier-flex",
  bitcoin: "text-tier-ultrafast",
  coins: "text-tier-priority",
  plane: "text-info",
  ship: "text-info",
  package: "text-tier-ultrafast",
  route: "text-tier-flex",
  "map-pin": "text-negative-text",
  "message-square": "text-tier-priority",
  layers: "text-tier-priority",
  mic: "text-tier-priority",
  "volume-2": "text-tier-priority",
  image: "text-tier-priority",
  languages: "text-tier-priority",
  "file-search": "text-tier-priority",
  network: "text-tier-flex",
  "badge-check": "text-tier-flex",
  "shield-check": "text-tier-flex",
  building: "text-tier-flex",
  search: "text-info",
  trophy: "text-tier-ultrafast",
};

/** Lucide icon name of a market: its own override, else its category icon. */
export function marketIconName(marketId: string): string {
  const spec = getMarketSpec(marketId);
  if (!spec) return "layers";
  return spec.icon ?? getCategory(spec.categoryId)?.icon ?? "layers";
}

export interface MarketGlyphProps extends Omit<LucideProps, "ref"> {
  /** Registry icon name, e.g. "cloud", "languages", "chart-line". */
  icon: string;
  /** Use the icon's accent color. Default true. */
  tinted?: boolean;
}

/** Lucide icon for a registry icon name (market or category). */
export function MarketGlyph({ icon, tinted = true, className, ...props }: MarketGlyphProps) {
  const Icon = ICONS[icon] ?? Layers;
  return <Icon aria-hidden className={cn(tinted && (ICON_TONE[icon] ?? "text-muted-foreground"), className)} strokeWidth={2} {...props} />;
}

/** 28px circle with the market icon, like OpenRouter's model favicon. */
export function MarketIconCircle({ icon, className }: { icon: string; className?: string }) {
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

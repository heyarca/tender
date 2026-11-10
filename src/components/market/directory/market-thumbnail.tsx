import type { MarketImage } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { MarketGlyph } from "@/components/market/page/market-icon";

/** Market photo (grayscale, like the list cards), or the market glyph on a muted tile when it has none. */
export function MarketThumbnail({ image, icon, size, className }: { image?: MarketImage; icon?: string; size: number; className?: string }) {
  const box = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted", className);
  if (!image) {
    return (
      <span className={box} style={{ width: size, height: size }}>
        {icon ? <MarketGlyph icon={icon} className="size-4" /> : null}
      </span>
    );
  }
  return (
    <picture className={box} style={{ width: size, height: size }}>
      {image.avif ? <source srcSet={image.avif} type="image/avif" /> : null}
      <img src={image.src} alt="" width={size} height={size} loading="lazy" className="size-full object-cover grayscale contrast-110" />
    </picture>
  );
}

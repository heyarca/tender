import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ProviderGlyphProps {
  name: string;
  /** Logo path under `/public` (e.g. `/providers/together.png`). Falls back to a colored initial. */
  logo?: string;
  /** Fallback color (CSS color or `var(--chart-n)`). */
  color?: string;
  /** Box size in px. Default 16. */
  size?: number;
  className?: string;
}

/**
 * Small provider logo box matching OpenRouter's provider cell: white tile, rounded-sm, a faint inset
 * ring, logo `object-contain`. Decorative — pair it with the provider name.
 */
export function ProviderGlyph({ name, logo, color, size = 16, className }: ProviderGlyphProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-background",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={size * 2}
          height={size * 2}
          unoptimized
          draggable={false}
          className="absolute inset-px size-[calc(100%-2px)] rounded-[3px] object-contain"
        />
      ) : (
        <span
          className="flex size-full items-center justify-center text-[9px] font-semibold leading-none text-primary-foreground"
          style={{ background: color ?? "var(--text-faint)" }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-border/60 ring-inset" />
    </span>
  );
}

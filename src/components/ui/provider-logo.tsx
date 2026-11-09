import type * as React from "react";

import { cn } from "@/lib/utils";

export type ProviderLogoSize = 16 | 20 | 24 | 28;

const boxSize: Record<ProviderLogoSize, string> = {
  16: "size-4",
  20: "size-5",
  24: "size-6",
  28: "size-7",
};

const fallbackText: Record<ProviderLogoSize, string> = {
  16: "text-[9px]",
  20: "text-micro",
  24: "text-caption",
  28: "text-caption",
};

export interface ProviderLogoProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Image URL, for example `/providers/together.png`. Without it, the first letter of `name` is shown. */
  src?: string | null;
  /** Provider name. Used for the fallback letter and, with `decorative={false}`, as alt text. */
  name: string;
  /** Box size in px (the 1px frame is added outside, like OpenRouter). Defaults to 20. */
  size?: ProviderLogoSize;
  /**
   * When the name is rendered next to the logo (the usual case), keep the image decorative.
   * Set to `false` to expose `name` as the image's alt text.
   */
  decorative?: boolean;
}

/**
 * OpenRouter's provider favicon box: white tile, 4px radius, 1px inner padding,
 * `object-contain` image, and an inset hairline ring painted above the image.
 */
export function ProviderLogo({
  src,
  name,
  size = 20,
  decorative = true,
  className,
  ...props
}: ProviderLogoProps) {
  return (
    <span
      data-slot="provider-logo"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "relative box-content flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-background p-px",
        boxSize[size],
        className,
      )}
      {...props}
    >
      {src ? (
        // Plain <img>: logos are small static files of mixed formats (svg/png/webp/jpg).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          decoding="async"
          draggable={false}
          className="absolute inset-px size-[calc(100%-2px)] rounded-sm object-contain"
        />
      ) : (
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-sm bg-muted font-medium text-muted-foreground uppercase",
            fallbackText[size],
          )}
        >
          {name.trim().charAt(0)}
        </span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-border/60 ring-inset"
      />
    </span>
  );
}

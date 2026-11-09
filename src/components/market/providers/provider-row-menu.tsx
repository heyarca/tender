"use client";

import { Menu } from "@base-ui/react/menu";
import { useRef } from "react";
import { Ellipsis, Pin, PinOff, SlidersHorizontal, Zap } from "lucide-react";

import { focusSection } from "@/components/market/market-ui";
import { buttonVariants } from "@/components/ui/button";
import type { MarketId, ProviderRow, RoutingMode } from "@/lib/tender";
import { useTenderActions } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

const itemClass = cn(
  "flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-body whitespace-nowrap text-foreground outline-none select-none",
  "data-highlighted:bg-accent-subtle data-highlighted:text-accent-foreground",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-highlighted:[&_svg]:text-accent-foreground",
);

export interface ProviderRowMenuProps {
  marketId: MarketId;
  row: ProviderRow;
  mode: RoutingMode;
  onSelect: (providerId: string) => void;
}

/** Row actions: edit conditions, pin, and back to automatic switching. */
export function ProviderRowMenu({ marketId, row, mode, onSelect }: ProviderRowMenuProps) {
  const { setRoutingMode } = useTenderActions();
  const pinnedHere = mode.kind === "pinned" && mode.providerId === row.id;
  // "Edit conditions" moves focus to the conditions heading; keep it there when the menu closes.
  const focusMoved = useRef(false);

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Actions for ${row.name}`}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground data-popup-open:bg-accent-subtle data-popup-open:text-accent-foreground",
        )}
      >
        <Ellipsis aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup
            onClick={(event) => event.stopPropagation()}
            finalFocus={() => {
              if (!focusMoved.current) return true;
              focusMoved.current = false;
              // Scroll now; Base UI focuses the returned heading once the menu has closed.
              focusSection("conditions");
              return document.getElementById("conditions-title") ?? true;
            }}
            className={cn(
              "min-w-52 rounded-lg bg-popover p-1 text-popover-foreground shadow-popover outline-none",
              "origin-(--transform-origin) transition-[opacity,scale] duration-quick ease-smooth-out",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0",
              "motion-reduce:transition-none",
            )}
          >
            <Menu.Item
              className={itemClass}
              onClick={() => {
                onSelect(row.id);
                focusMoved.current = true;
              }}
            >
              <SlidersHorizontal aria-hidden="true" />
              Edit conditions
            </Menu.Item>
            {pinnedHere ? null : (
              <Menu.Item
                className={itemClass}
                onClick={() => setRoutingMode(marketId, { kind: "pinned", providerId: row.id })}
              >
                <Pin aria-hidden="true" />
                Pin provider
              </Menu.Item>
            )}
            {mode.kind === "pinned" ? (
              <Menu.Item className={itemClass} onClick={() => setRoutingMode(marketId, { kind: "auto" })}>
                {pinnedHere ? <PinOff aria-hidden="true" /> : <Zap aria-hidden="true" />}
                Use automatic switching
              </Menu.Item>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

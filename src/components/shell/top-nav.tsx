"use client";

import { Menu } from "@base-ui/react/menu";
import { Menu as MenuIcon, Search, X } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { TenderLogo } from "./tender-logo";

export interface TopNavLink {
  label: string;
  href: string;
}

export interface TopNavProps {
  links: readonly TopNavLink[];
  /** `href` of the current link. It gets `aria-current="page"` and the grape text color. */
  activeHref?: string;
  /** Opens the command palette (search trigger click). Bind ⌘K with `useHotkey` or `CommandPalette`. */
  onSearch: () => void;
  /** Right-most slot for one primary button. */
  actions?: React.ReactNode;
  /** Search trigger text. Default "Search". */
  searchLabel?: string;
  /** Logo link target. Default "/". */
  homeHref?: string;
  className?: string;
}

const FOCUS = "focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none";

/** Ghost nav button recipe (OpenRouter `data-nav-button`). */
const NAV_BUTTON_BASE = cn(
  "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 text-button font-medium whitespace-nowrap no-underline select-none transition-colors duration-quick",
  "hover:bg-accent-subtle hover:text-accent-foreground active:bg-accent-subtle/80",
  FOCUS,
);
const NAV_BUTTON = cn(NAV_BUTTON_BASE, "[&_svg]:size-4 [&_svg]:shrink-0");

/**
 * Sticky top bar like OpenRouter's: lockup, ⌘K search trigger, ghost links,
 * and one primary action. Below `lg` the links collapse into a menu.
 */
export function TopNav({
  links,
  activeHref,
  onSearch,
  actions,
  searchLabel = "Search",
  homeHref = "/",
  className,
}: TopNavProps) {
  return (
    <header
      data-top-nav=""
      className={cn("sticky top-0 z-40 h-(--navbar-height) w-full border-b border-border bg-background", className)}
    >
      <div className="mx-auto flex h-full w-full items-center px-4 lg:px-6">
        <Link href={homeHref} aria-label="Tender home" className={cn(NAV_BUTTON_BASE, "-ml-2 text-foreground lg:ml-0")}>
          <TenderLogo />
        </Link>

        <div className="ml-12 hidden min-w-8 shrink lg:block xl:ml-20">
          <button
            type="button"
            onClick={onSearch}
            aria-label={searchLabel}
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(
              "inline-flex h-8 w-60 max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-input bg-input-bg px-3 text-left text-button font-normal whitespace-nowrap text-muted-foreground transition-colors duration-quick select-none hover:border-focus-border [&_svg]:size-4 [&_svg]:shrink-0",
              FOCUS,
            )}
          >
            <Search aria-hidden />
            <span className="flex-1 truncate text-sm text-current/70">{searchLabel}</span>
            <KbdGroup keys={["⌘", "K"]} aria-hidden />
          </button>
        </div>

        <nav aria-label="Main" className="ml-auto hidden shrink-0 items-center gap-1 pl-10 lg:flex">
          {links.map((link) => {
            const active = link.href === activeHref;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(NAV_BUTTON, active ? "text-accent-foreground" : "text-muted-foreground")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {actions ? <div className="ml-1 hidden shrink-0 items-center gap-1 lg:flex">{actions}</div> : null}

        <div className="-mr-2 ml-auto flex min-w-0 items-center justify-end gap-1 lg:hidden">
          <button
            type="button"
            onClick={onSearch}
            aria-label={searchLabel}
            className={cn(NAV_BUTTON, "w-8 px-0 text-muted-foreground")}
          >
            <Search aria-hidden />
          </button>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
          {links.length > 0 ? <MobileMenu links={links} activeHref={activeHref} /> : null}
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ links, activeHref }: { links: readonly TopNavLink[]; activeHref?: string }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger aria-label="Menu" className={cn(NAV_BUTTON, "group w-8 px-0 text-muted-foreground data-popup-open:bg-accent-subtle data-popup-open:text-accent-foreground")}>
        <MenuIcon className="group-data-popup-open:hidden" aria-hidden />
        <X className="hidden group-data-popup-open:block" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup className="min-w-48 origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow-popover outline-none transition-[opacity,scale] duration-quick ease-smooth-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none">
            {links.map((link) => {
              const active = link.href === activeHref;
              return (
                <Menu.LinkItem
                  key={link.href}
                  closeOnClick
                  aria-current={active ? "page" : undefined}
                  render={<Link href={link.href} />}
                  className={cn(
                    "flex h-9 cursor-pointer items-center rounded-md px-2.5 text-button font-medium no-underline outline-none select-none data-highlighted:bg-accent-subtle data-highlighted:text-accent-foreground",
                    active ? "text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

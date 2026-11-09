"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  /** Stable key. Falls back to `href` or `label`. */
  id?: string;
  label: string;
  /** Route (`/markets/btc-usd`) or in-page anchor (`#providers`). */
  href?: string;
  /** Runs on click. With no `href`, the item renders as a button. */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  /** 16px icon, for example a lucide icon element or a logo `<img>`. */
  icon?: React.ReactNode;
  active?: boolean;
  /** Right-aligned extra content, such as a count or a status dot. */
  trailing?: React.ReactNode;
}

export interface SidebarNavGroup {
  id?: string;
  /** Optional caption above the items. */
  label?: string;
  items: readonly SidebarNavItem[];
}

export interface SidebarNavProps {
  groups: readonly SidebarNavGroup[];
  /** Accessible name of the `nav` landmark. Default "Page sections". */
  "aria-label"?: string;
  /** Sticks under the TopNav (and the StickyBar while it shows). Default `true`. */
  sticky?: boolean;
  className?: string;
}

const STICKY_TOP =
  "sticky top-[calc(var(--navbar-height)+var(--sticky-bar-offset,0px)+24px)] transition-[top] duration-fast ease-smooth-out motion-reduce:transition-none";

function itemKey(item: SidebarNavItem) {
  return item.id ?? item.href ?? item.label;
}

function isAnchor(href: string) {
  return href.startsWith("#");
}

const ITEM_BASE =
  "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-body font-medium no-underline transition-colors duration-quick focus-visible:shadow-focus focus-visible:outline-none [&_img]:size-4 [&_img]:shrink-0 [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * OpenRouter-style section navigation for the left column of
 * `grid lg:grid-cols-[200px_1fr]`. Pair it with `useScrollSpy` to set `active`.
 * Hide it below `lg` and render `SidebarNavMenu` there instead.
 */
export function SidebarNav({ groups, "aria-label": ariaLabel = "Page sections", sticky = true, className }: SidebarNavProps) {
  const baseId = React.useId();
  return (
    <nav aria-label={ariaLabel} className={cn("flex flex-col gap-5", sticky && STICKY_TOP, className)}>
      {groups.map((group, groupIndex) => {
        const labelId = group.label ? `${baseId}-group-${groupIndex}` : undefined;
        return (
          <div key={group.id ?? group.label ?? groupIndex} role="group" aria-labelledby={labelId} className="flex flex-col">
            {group.label ? (
              <div id={labelId} className="px-2 pb-1 text-caption font-medium text-muted-foreground">
                {group.label}
              </div>
            ) : null}
            <ul className="flex flex-col gap-y-px">
              {group.items.map((item) => (
                <li key={itemKey(item)}>
                  <SidebarNavLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarNavLink({ item }: { item: SidebarNavItem }) {
  const className = cn(
    ITEM_BASE,
    item.active
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-card-hover hover:text-accent-foreground",
  );
  const content = (
    <>
      {item.icon}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.trailing != null ? (
        <span className="ml-auto flex shrink-0 items-center text-caption text-faint">{item.trailing}</span>
      ) : null}
    </>
  );
  if (item.href === undefined) {
    return (
      <button type="button" className={className} onClick={item.onClick} aria-current={item.active ? "true" : undefined}>
        {content}
      </button>
    );
  }
  if (isAnchor(item.href)) {
    return (
      <a href={item.href} className={className} onClick={item.onClick} aria-current={item.active ? "location" : undefined}>
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={item.onClick} aria-current={item.active ? "page" : undefined}>
      {content}
    </Link>
  );
}

export interface SidebarNavMenuProps {
  groups: readonly SidebarNavGroup[];
  /** Trigger text when no item is active. Default "On this page". */
  placeholder?: string;
  /** Sticks under the TopNav (and the StickyBar while it shows). Default `true`. */
  sticky?: boolean;
  className?: string;
}

const MENU_ITEM =
  "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body font-medium text-muted-foreground no-underline outline-none select-none data-highlighted:bg-accent-subtle data-highlighted:text-accent-foreground [&_img]:size-4 [&_img]:shrink-0 [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * Compact dropdown version of `SidebarNav` for small screens (hidden from `lg`),
 * like OpenRouter's mobile section picker.
 */
export function SidebarNavMenu({ groups, placeholder = "On this page", sticky = true, className }: SidebarNavMenuProps) {
  // The most specific active item wins (for example the section over the market).
  const activeItem = groups.flatMap((group) => group.items).findLast((item) => item.active);
  return (
    <div
      className={cn(
        "-mx-4 bg-background px-4 py-2 lg:hidden",
        sticky &&
          "sticky top-[calc(var(--navbar-height)+var(--sticky-bar-offset,0px))] z-20 transition-[top] duration-fast ease-smooth-out motion-reduce:transition-none",
        className,
      )}
    >
      <Menu.Root modal={false}>
        <Menu.Trigger className="inline-flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-4 text-button font-medium text-foreground transition-colors duration-quick hover:bg-muted focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none data-popup-open:bg-muted [&_svg]:size-4 [&_svg]:shrink-0">
          <span className="flex min-w-0 items-center gap-2">
            {activeItem?.icon}
            <span className="truncate">{activeItem?.label ?? placeholder}</span>
          </span>
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="start" className="z-50 outline-none">
            <Menu.Popup className="w-(--anchor-width) origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow-popover outline-none transition-[opacity,scale] duration-quick ease-smooth-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none">
              {groups.map((group, groupIndex) => (
                <Menu.Group key={group.id ?? group.label ?? groupIndex} className="flex flex-col py-0.5">
                  {group.label ? (
                    <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-caption font-medium text-muted-foreground">
                      {group.label}
                    </Menu.GroupLabel>
                  ) : null}
                  {group.items.map((item) => (
                    <SidebarNavMenuItem key={itemKey(item)} item={item} />
                  ))}
                </Menu.Group>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function SidebarNavMenuItem({ item }: { item: SidebarNavItem }) {
  const className = cn(MENU_ITEM, item.active && "text-accent-foreground");
  const content = (
    <>
      {item.icon}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.active ? <Check className="text-accent-foreground" aria-hidden /> : null}
    </>
  );
  if (item.href === undefined) {
    return (
      <Menu.Item className={className} onClick={item.onClick}>
        {content}
      </Menu.Item>
    );
  }
  const anchor = isAnchor(item.href);
  return (
    <Menu.LinkItem
      closeOnClick
      className={className}
      onClick={item.onClick}
      aria-current={item.active ? (anchor ? "location" : "page") : undefined}
      render={anchor ? <a href={item.href} /> : <Link href={item.href} />}
    >
      {content}
    </Menu.LinkItem>
  );
}

export interface ScrollSpyOptions {
  /**
   * Distance in px from the top of the viewport where a section becomes active.
   * Default 120 (TopNav + StickyBar + breathing room).
   */
  offset?: number;
  enabled?: boolean;
}

/**
 * Returns the id of the section currently under the TopNav: the last of `ids`
 * whose top edge has passed `offset`. At the bottom of the page the last
 * section wins. Returns the first id before mount, so SSR and hydration agree.
 */
export function useScrollSpy(ids: readonly string[], { offset = 120, enabled = true }: ScrollSpyOptions = {}) {
  const key = ids.join("\u0000");
  const idList = React.useMemo(() => (key === "" ? [] : key.split("\u0000")), [key]);
  const [activeId, setActiveId] = React.useState<string | null>(idList[0] ?? null);

  React.useEffect(() => {
    if (!enabled || idList.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = idList
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null);
      if (sections.length === 0) return;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top - offset <= 1) current = section.id;
      }
      const root = document.documentElement;
      const atBottom = root.scrollHeight > root.clientHeight && window.innerHeight + window.scrollY >= root.scrollHeight - 2;
      if (atBottom) current = sections[sections.length - 1].id;
      setActiveId(current);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [idList, offset, enabled]);

  return activeId;
}

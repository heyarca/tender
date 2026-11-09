"use client";

import { Command, defaultFilter } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export interface CommandPaletteItem {
  /** Unique across the palette. */
  id: string;
  label: string;
  /** Muted text after the label, for example an identifier. */
  description?: string;
  /** 16px icon element. */
  icon?: React.ReactNode;
  /** Logo URL shown in a 20px framed box (provider logos). Used when `icon` is not set. */
  image?: string;
  /** Extra search terms. */
  keywords?: readonly string[];
  /** Key chips on the right, for example `["⌘", "↵"]`. */
  shortcut?: readonly string[];
  onSelect: () => void;
}

export interface CommandPaletteGroup {
  heading: string;
  items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly CommandPaletteGroup[];
  /** Input placeholder. Default "Search markets, providers, and actions". */
  placeholder?: string;
  /** Combo that toggles the palette. Default `"mod+k"` (⌘K or Ctrl+K). `false` disables it. */
  hotkey?: string | false;
}

/**
 * ⌘K command palette: cmdk inside the Tender `Dialog`. Selecting an item runs
 * its `onSelect` and closes the palette.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = "Search markets, providers, and actions",
  hotkey = "mod+k",
}: CommandPaletteProps) {
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // cmdk ranks items inside each group but never reorders the groups, so while
  // searching the groups are ordered by their best item score (the same score cmdk
  // computes through the filter) and the best group's top item wins Enter.
  const orderedGroups = React.useMemo(() => {
    if (!search) return groups;
    const best = groups.map((group, index) => ({
      index,
      group,
      score: Math.max(0, ...group.items.map((item) => defaultFilter(itemKeywords(item).join(" "), search))),
    }));
    return best.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.group);
  }, [groups, search]);

  const setOpen = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };

  useHotkey(hotkey || "mod+k", () => setOpen(!open), { enabled: hotkey !== false });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        placement="top"
        showCloseButton={false}
        initialFocus={inputRef}
        className="max-w-[640px] overflow-hidden"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command label="Search" loop vimBindings={false} filter={filterByKeywords} className="flex min-h-0 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder={placeholder}
              className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-faint"
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="max-h-[min(400px,calc(100dvh-12vh-160px))] scroll-py-2 overflow-y-auto overscroll-contain p-2">
            <Command.Empty className="px-2 py-8 text-center text-body text-muted-foreground">
              No results for &ldquo;{search}&rdquo;
            </Command.Empty>
            {orderedGroups.map((group) => (
              <Command.Group
                key={group.heading}
                heading={group.heading}
                className="[&:not(:first-child)]:mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {group.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    keywords={itemKeywords(item)}
                    onSelect={() => {
                      item.onSelect();
                      setOpen(false);
                    }}
                    className="group/item flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-body text-foreground select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent-subtle data-[selected=true]:text-accent-foreground"
                  >
                    <PaletteItemIcon item={item} />
                    <span className="min-w-0 truncate font-medium">{item.label}</span>
                    {item.description ? (
                      <span className="min-w-0 truncate text-caption text-muted-foreground">{item.description}</span>
                    ) : null}
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {item.shortcut?.length ? <KbdGroup keys={item.shortcut} /> : null}
                      <CornerDownLeft
                        className="hidden size-3.5 text-accent-foreground group-data-[selected=true]/item:block"
                        aria-hidden
                      />
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex h-10 shrink-0 items-center gap-4 border-t border-border px-4 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <KbdGroup keys={["↑", "↓"]} />
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              Select
            </span>
            <span className="ml-auto hidden items-center gap-1.5 sm:flex">
              <KbdGroup keys={["⌘", "K"]} />
              Toggle
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** Matches label, description, and keywords only, so item ids never match a query. */
function filterByKeywords(_value: string, search: string, keywords?: string[]) {
  return defaultFilter(keywords?.join(" ") ?? "", search);
}

/** The searchable text of an item: label, description, then extra keywords. */
function itemKeywords(item: CommandPaletteItem): string[] {
  return [item.label, ...(item.description ? [item.description] : []), ...(item.keywords ?? [])];
}

function PaletteItemIcon({ item }: { item: CommandPaletteItem }) {
  if (item.icon) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground group-data-[selected=true]/item:text-accent-foreground [&_svg]:size-4">
        {item.icon}
      </span>
    );
  }
  if (item.image) {
    return (
      <span className="relative box-content flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-background p-px">
        <Image src={item.image} alt="" width={20} height={20} unoptimized className="size-full rounded-sm object-contain" />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-border/60 ring-inset" />
      </span>
    );
  }
  return <span className="size-5 shrink-0" aria-hidden />;
}

export interface HotkeyOptions {
  /** Default `true`. */
  enabled?: boolean;
  /** Calls `event.preventDefault()` on match. Default `true`. */
  preventDefault?: boolean;
  /**
   * Fire while focus is in a text field. Combos with ⌘, Ctrl, or Alt always fire;
   * plain keys (like `/`) do not unless this is `true`.
   */
  allowInInputs?: boolean;
}

interface ParsedCombo {
  key: string;
  mod: boolean;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const KEY_ALIASES: Record<string, string> = { esc: "escape", return: "enter", space: " ", spacebar: " " };

/**
 * Physical `event.code` names for symbol keys, mirroring the letter/digit fallback:
 * Shifted characters never match by `key` (Shift+/ sends key="?"), and non-Latin
 * layouts keep working because the physical key does not move.
 */
const CODE_ALIASES: Record<string, string> = {
  "/": "Slash",
  "\\": "Backslash",
  "[": "BracketLeft",
  "]": "BracketRight",
  "'": "Quote",
  ";": "Semicolon",
  ",": "Comma",
  ".": "Period",
  "-": "Minus",
  "=": "Equal",
};

export function parseHotkey(combo: string): ParsedCombo {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const parsed: ParsedCombo = { key: "", mod: false, meta: false, ctrl: false, alt: false, shift: false };
  for (const part of parts) {
    if (part === "mod") parsed.mod = true;
    else if (part === "meta" || part === "cmd" || part === "command") parsed.meta = true;
    else if (part === "ctrl" || part === "control") parsed.ctrl = true;
    else if (part === "alt" || part === "option") parsed.alt = true;
    else if (part === "shift") parsed.shift = true;
    else parsed.key = KEY_ALIASES[part] ?? part;
  }
  return parsed;
}

function keyMatches(event: KeyboardEvent, key: string) {
  if (event.key.toLowerCase() === key) return true;
  // Match the physical key so shortcuts work with non-Latin layouts and IMEs.
  if (/^[a-z]$/.test(key)) return event.code === `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return event.code === `Digit${key}`;
  return CODE_ALIASES[key] !== undefined && event.code === CODE_ALIASES[key];
}

/** True when the keyboard event matches a combo such as `"mod+k"`, `"shift+/"`, or `"escape"`. */
export function matchesHotkey(event: KeyboardEvent, combo: string | ParsedCombo) {
  const parsed = typeof combo === "string" ? parseHotkey(combo) : combo;
  if (!parsed.key || !keyMatches(event, parsed.key)) return false;
  if (event.altKey !== parsed.alt || event.shiftKey !== parsed.shift) return false;
  if (parsed.mod) {
    if (!event.metaKey && !event.ctrlKey) return false;
    if (parsed.meta && !event.metaKey) return false;
    if (parsed.ctrl && !event.ctrlKey) return false;
    return true;
  }
  return event.metaKey === parsed.meta && event.ctrlKey === parsed.ctrl;
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(type);
}

/**
 * Global keyboard shortcut. `combo` is `"mod+k"` style: `mod` means ⌘ or Ctrl,
 * plus `meta`, `ctrl`, `alt`, `shift`, and one key. Pass an array for alternatives.
 */
export function useHotkey(
  combo: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  { enabled = true, preventDefault = true, allowInInputs = false }: HotkeyOptions = {},
) {
  const comboKey = typeof combo === "string" ? combo : combo.join("\u0000");
  const onMatch = React.useEffectEvent(handler);

  React.useEffect(() => {
    if (!enabled) return;
    const combos = comboKey.split("\u0000").map(parseHotkey);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return;
      const match = combos.find((parsed) => matchesHotkey(event, parsed));
      if (!match) return;
      const hasModifier = match.mod || match.meta || match.ctrl || match.alt;
      if (!hasModifier && !allowInInputs && isEditable(event.target)) return;
      if (preventDefault) event.preventDefault();
      onMatch(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [comboKey, enabled, preventDefault, allowInInputs]);
}

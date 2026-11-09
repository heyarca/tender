"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Height of the bar. Published as `--sticky-bar-offset` on `<html>` while the bar shows. */
const BAR_HEIGHT = 44;

function navbarHeightPx() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const raw = styles.getPropertyValue("--navbar-height").trim();
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return 56;
  if (raw.endsWith("rem")) return value * Number.parseFloat(styles.fontSize || "16");
  return value;
}

export interface StickyBarProps {
  /** Id of the element (usually the page title row) that hides the bar while visible. */
  sentinelId?: string;
  /** Ref alternative to `sentinelId`. */
  sentinelRef?: React.RefObject<Element | null>;
  /** Accessible name of the bar region. */
  "aria-label"?: string;
  className?: string;
  /** Row content: usually `StickyBarTitle` on the left and `StickyBarActions` on the right. */
  children: React.ReactNode;
}

/**
 * Compact bar that slides in under the TopNav once the sentinel scrolls under it,
 * like OpenRouter's scrolled model title bar. While it shows, it sets
 * `--sticky-bar-offset: 44px` on `<html>` so sticky siblings (SidebarNav) can move down.
 */
export function StickyBar({ sentinelId, sentinelRef, "aria-label": ariaLabel, className, children }: StickyBarProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let target: Element | null = null;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    const update = () => {
      frame = 0;
      if (!target) return;
      setVisible(target.getBoundingClientRect().bottom <= navbarHeightPx());
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    // (Re)bind the sentinel: it may mount after data loads or be replaced, so the
    // document is watched and the lookup retried on every DOM change.
    const bind = () => {
      const next = sentinelRef?.current ?? (sentinelId ? document.getElementById(sentinelId) : null);
      if (!next) return;
      if (next !== target) {
        target = next;
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(target);
      }
      schedule();
    };

    bind();
    const mutations = new MutationObserver(bind);
    mutations.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mutations.disconnect();
      resizeObserver?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [sentinelId, sentinelRef]);

  React.useEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    root.style.setProperty("--sticky-bar-offset", `${BAR_HEIGHT}px`);
    return () => {
      root.style.removeProperty("--sticky-bar-offset");
    };
  }, [visible]);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-hidden={!visible}
      inert={!visible}
      data-visible={visible}
      className={cn(
        "fixed inset-x-0 top-(--navbar-height) z-30 border-b border-border bg-background/95 backdrop-blur-sm",
        "transition-[opacity,translate] duration-quick ease-smooth-out motion-reduce:transition-opacity",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        className,
      )}
    >
      <div className="mx-auto flex h-11 w-full items-center justify-between gap-3 px-4 md:max-w-7xl lg:px-6">{children}</div>
    </div>
  );
}

export interface StickyBarTitleProps extends Omit<React.ComponentProps<"button">, "children"> {
  /** 20px round icon on the left (favicon-style). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/** Icon + name on the left of the bar. Scrolls back to the top on click unless `onClick` is set. */
export function StickyBarTitle({ icon, children, className, onClick, ...props }: StickyBarTitleProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-2 rounded-md text-left focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
      onClick={
        onClick ??
        (() => {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        })
      }
      {...props}
    >
      {icon ? (
        <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background p-0.5 [&_img]:size-full [&_img]:object-contain [&_svg]:size-3">
          {icon}
        </span>
      ) : null}
      <span className="truncate text-sm font-medium text-foreground">{children}</span>
    </button>
  );
}

/** Right-aligned action row of the bar. */
export function StickyBarActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 items-center gap-1.5", className)} {...props} />;
}

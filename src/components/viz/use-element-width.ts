"use client";

import { useEffect, useState } from "react";

/**
 * Width of an element, tracked with ResizeObserver. Returns `initialWidth` on the server and on the
 * first client render (so hydration matches), then the measured width after mount.
 *
 * ```tsx
 * const [ref, width] = useElementWidth<HTMLDivElement>(640);
 * return <div ref={ref}>…</div>;
 * ```
 */
export function useElementWidth<T extends Element = HTMLDivElement>(
  initialWidth: number,
): [ref: (node: T | null) => void, width: number, measured: boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setMeasured(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, measured ?? initialWidth, measured !== null];
}

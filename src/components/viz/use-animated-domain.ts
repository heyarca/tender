"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/** The visible window of a chart: x (time or index) and y (value) bounds. */
export interface ChartDomain {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function sameDomain(a: ChartDomain, b: ChartDomain) {
  return a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1;
}

export function lerpDomain(from: ChartDomain, to: ChartDomain, t: number): ChartDomain {
  if (t >= 1) return to;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return { x0: lerp(from.x0, to.x0), x1: lerp(from.x1, to.x1), y0: lerp(from.y0, to.y0), y1: lerp(from.y1, to.y1) };
}

/** Ease-out cubic. */
export function easeOut(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

interface TweenState<T> {
  target: ChartDomain;
  from: ChartDomain;
  /** Data that was on screen when the current animation started (for sliding windows). */
  previous: T | null;
  progress: number;
  generation: number;
}

export interface AnimatedDomain<T> {
  /** Domain to draw with this frame. */
  domain: ChartDomain;
  /** The payload from before the latest change, while the transition runs; otherwise null. */
  previous: T | null;
  animating: boolean;
}

/**
 * Tweens a chart's domain whenever it changes, so new samples slide in from the right and the
 * vertical scale eases instead of jumping. The first render (server and client) uses the target
 * directly, so there is nothing to hydrate. Honors `prefers-reduced-motion`.
 *
 * `payload` is the data currently drawn. When the domain changes, the old payload is returned as
 * `previous` until the transition ends, so callers can keep drawing points that are sliding out.
 */
export function useAnimatedDomain<T>(target: ChartDomain, payload: T, duration = 300): AnimatedDomain<T> {
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<TweenState<T>>(() => ({
    target,
    from: target,
    previous: null,
    progress: 1,
    generation: 0,
  }));
  const [payloadState, setPayloadState] = useState(payload);

  let current = state;
  if (!sameDomain(state.target, target)) {
    const shown = lerpDomain(state.from, state.target, easeOut(state.progress));
    const animate = !reducedMotion && duration > 0;
    current = {
      target,
      from: animate ? shown : target,
      previous: animate ? payloadState : null,
      progress: animate ? 0 : 1,
      generation: state.generation + 1,
    };
    setState(current);
  }
  if (payloadState !== payload) setPayloadState(payload);

  const { generation } = current;
  const running = current.progress < 1;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      setState((prev) =>
        prev.generation !== generation
          ? prev
          : { ...prev, progress, previous: progress >= 1 ? null : prev.previous },
      );
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [generation, running, duration]);

  return {
    domain: lerpDomain(current.from, current.target, easeOut(current.progress)),
    previous: current.progress < 1 ? current.previous : null,
    animating: current.progress < 1,
  };
}

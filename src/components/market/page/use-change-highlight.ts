"use client";

import { useEffect, useState } from "react";

/**
 * `true` for `duration` ms after `value` changes (not on mount). Drives a short highlight
 * so a change, such as a new active provider, is easy to follow.
 */
export function useChangeHighlight<T>(value: T, duration = 1600): boolean {
  const [state, setState] = useState({ value, active: false, key: 0 });
  if (!Object.is(state.value, value)) {
    setState({ value, active: true, key: state.key + 1 });
  }
  const { active, key } = state;
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setState((current) => (current.key === key ? { ...current, active: false } : current));
    }, duration);
    return () => clearTimeout(timer);
  }, [active, key, duration]);
  return state.active;
}

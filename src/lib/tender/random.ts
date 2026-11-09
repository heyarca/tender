/**
 * Seeded PRNG (mulberry32). The seed lives in state so reducers stay pure:
 * create an `Rng` from the stored seed, draw, then store `rng.state` back.
 */

/** Advance a mulberry32 state. Returns `[value in [0, 1), nextState]`. */
export function mulberry32(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Small mutable wrapper for a sequence of draws inside one reducer step. */
export interface Rng {
  /** Current state; write it back to the store after drawing. */
  readonly state: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Approximately standard normal (Box–Muller). */
  normal(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    const [value, nextState] = mulberry32(state);
    state = nextState;
    return value;
  };
  return {
    get state() {
      return state;
    },
    next,
    range: (min, max) => min + (max - min) * next(),
    normal: () => {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

/** Stateless 32-bit hash of an integer pair to [0, 1). Used for time-based signals. */
export function hash01(seed: number, index: number): number {
  let h = (seed ^ Math.imul(index | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Stateless approximately standard normal value for an integer pair. */
export function hashNormal(seed: number, index: number): number {
  const u = Math.max(hash01(seed, index * 2), 1e-12);
  const v = hash01(seed ^ 0x5bd1e995, index * 2 + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

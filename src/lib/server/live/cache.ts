/** Per-instance cache of upstream answers: a hit skips the upstream call; failures are not kept. */
export class AnswerCache<T> {
  private readonly entries = new Map<string, { expires: number; promise: Promise<T> }>();
  constructor(private readonly ttlMs: number, private readonly limit = 500) {}

  /** The cached answer for `key`, or `load()`; concurrent reads of one key share a single load. */
  get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing && existing.expires > now) return existing.promise;
    this.entries.delete(key);
    // Maps keep insertion order: drop the oldest entry when full.
    if (this.entries.size >= this.limit) this.entries.delete(this.entries.keys().next().value!);
    const promise = load();
    this.entries.set(key, { expires: now + this.ttlMs, promise });
    promise.catch(() => {
      if (this.entries.get(key)?.promise === promise) this.entries.delete(key);
    });
    return promise;
  }
}

/** An upstream failure: the request fails with this status and is neither charged nor settled. */
export class LiveError extends Error {
  constructor(public readonly status: 400 | 422 | 502, public readonly code: "unsupported_input" | "no_match" | "provider_error", message: string) {
    super(message);
  }
}

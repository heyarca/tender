/** Engine constants. All durations are milliseconds. */

/** Fixed start time of the initial state (server and first client render match). */
export const FIXTURE_EPOCH = Date.UTC(2026, 10, 9, 18, 30, 0); // 2026-11-09T18:30:00Z

/** Minimum time between optimization switches. Failover and operator changes ignore it. */
export const SWITCH_COOLDOWN_MS = 10_000;

/** Monitor tick: one sample per provider. */
export const MONITOR_INTERVAL_MS = 5_000;

/** Store clock tick. */
export const CLOCK_TICK_MS = 1_000;

/** Auto-run interval per market. */
export const AUTO_RUN_INTERVAL_MS = 2_000;

/** Monitor samples kept per provider. */
export const HISTORY_LIMIT = 30;

/** Request latency samples kept per provider. */
export const LATENCY_LIMIT = 30;

/** Requests kept per market. */
export const REQUEST_LOG_LIMIT = 50;

/** Activity entries kept per market. */
export const ACTIVITY_LIMIT = 200;

/** Points kept in a market's recent-value chart. */
export const SERIES_LIMIT = 60;

/** Historical chart points seeded at start. */
export const SERIES_SEED_POINTS = 40;

/** localStorage key for persisted policies. */
export const POLICIES_STORAGE_KEY = "tender:v1:policies";

/** Price unit suffix (USD per 1M requests). */
export const PRICE_UNIT = "/M req";

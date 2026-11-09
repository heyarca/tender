"use client";

/**
 * Client entry point: store, provider, and hooks.
 * `import { TenderProvider, useMarketView } from "@/lib/tender/client"`.
 */
export {
  createTenderStore,
  startTenderRuntime,
  TenderProvider,
  useMarketIds,
  useMarketView,
  useNow,
  usePendingSwitch,
  useRouteEvents,
  useTenderActions,
  useTenderSelector,
  useTenderStore,
  useWatchMarket,
} from "./store";
export type { CreateTenderStoreOptions, TenderActions, TenderProviderProps, TenderStore } from "./store";

import { describe, expect, it } from "vitest";

import {
  createInitialState,
  FIXTURE_EPOCH,
  reduce,
  selectMarketView,
  type TenderAction,
  type TenderState,
} from "@/lib/tender";

import { decisionFingerprint, describeMarketChange, joinNames } from "./market-change";
import { POLICY_FIELDS, draftPolicy, previewEligibility } from "./policy-helpers";

type ActionBody = TenderAction extends infer A ? (A extends TenderAction ? Omit<A, "now"> : never) : never;

function harness() {
  let now = FIXTURE_EPOCH + 1_000;
  let state: TenderState = reduce(createInitialState(), { type: "rebase", now });
  const view = (marketId: "sf-weather" | "btc-usd" = "sf-weather") => selectMarketView(state.markets[marketId]);
  const act = (action: ActionBody) => {
    now += 1_000;
    state = reduce(state, { ...action, now } as TenderAction);
  };
  const change = (action: ActionBody, focus?: string, marketId: "sf-weather" | "btc-usd" = "sf-weather") => {
    const before = view(marketId);
    act(action);
    return describeMarketChange(before, view(marketId), focus);
  };
  return { view, act, change, advance: (ms: number) => (now += ms) };
}

describe("joinNames", () => {
  it("joins with commas and 'and'", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("describeMarketChange", () => {
  it("explains a failover when the serving provider becomes too slow", () => {
    const { change } = harness();
    const note = change(
      { type: "update-provider", marketId: "sf-weather", providerId: "together", patch: { p95LatencyMs: 640 } },
      "together",
    );
    expect(note.lines).toEqual([
      "Together no longer qualifies: P95 640 ms exceeds 400 ms.",
      "Route switched from Together to DeepInfra, which ranks first for lowest cost.",
    ]);
    expect(note.tone).toBe("warning");
  });

  it("names providers that start qualifying after a policy edit", () => {
    const { change } = harness();
    const note = change({ type: "set-policy", marketId: "sf-weather", patch: { maxP95LatencyMs: 700 } });
    expect(note.lines).toContain("Cloudflare now qualifies.");
    expect(note.lines).toContain("Route switched from Together to Cloudflare, which ranks first for lowest cost.");
    expect(note.tone).toBe("positive");
  });

  it("reports no eligible provider", () => {
    const { change } = harness();
    const note = change({ type: "set-policy", marketId: "sf-weather", patch: { maxPrice: 5 } });
    expect(note.lines.at(-1)).toBe("No eligible provider. Requests are rejected until a provider qualifies.");
    expect(note.tone).toBe("negative");
  });

  it("reports a scheduled switch during the cooldown", () => {
    const { change } = harness();
    change({ type: "update-provider", marketId: "sf-weather", providerId: "together", patch: { p95LatencyMs: 640 } });
    const note = change(
      { type: "update-provider", marketId: "sf-weather", providerId: "cloudflare", patch: { p95LatencyMs: 200 } },
      "cloudflare",
    );
    expect(note.lines[0]).toBe("Cloudflare now qualifies.");
    expect(note.lines[1]).toBe("Cloudflare now ranks first. The route switches when the 10 s cooldown ends.");
  });

  it("surfaces a pinned provider that fails the policy", () => {
    const { change } = harness();
    const note = change({
      type: "set-routing-mode",
      marketId: "sf-weather",
      mode: { kind: "pinned", providerId: "cloudflare" },
    });
    expect(note.lines).toContain("Route switched from Together to Cloudflare.");
    expect(note.lines).toContain(
      "Pinned provider Cloudflare fails your policy: P95 640 ms exceeds 400 ms. Requests still go to Cloudflare.",
    );
    expect(note.tone).toBe("negative");
  });

  it("says the route is unchanged when an edit does not affect it", () => {
    const { change } = harness();
    const note = change(
      { type: "update-provider", marketId: "sf-weather", providerId: "mistral", patch: { bidPrice: 60 } },
      "mistral",
    );
    expect(note.lines).toEqual([
      "Mistral is still excluded: Bid $60.00 exceeds $40.00 /M.",
      "Route unchanged: Together keeps serving.",
    ]);
    expect(note.tone).toBe("neutral");
  });

  it("works with BTC millisecond data ages", () => {
    const { change } = harness();
    const note = change(
      { type: "update-provider", marketId: "btc-usd", providerId: "the-zone-bio", patch: { dataAgeMs: 1_220 } },
      "the-zone-bio",
      "btc-usd",
    );
    expect(note.lines[0]).toBe("THE ZONE BIO no longer qualifies: Data age 1.2 s exceeds 1 s.");
    expect(note.lines[1]).toMatch(/^Route switched from THE ZONE BIO to /);
  });
});

describe("decisionFingerprint", () => {
  it("ignores monitor samples and requests but tracks policy, conditions, and route", () => {
    const { view, act, advance } = harness();
    const initial = decisionFingerprint(view());
    advance(5_000);
    act({ type: "monitor" });
    act({ type: "run-request", marketId: "sf-weather" });
    expect(decisionFingerprint(view())).toBe(initial);
    act({ type: "set-policy", marketId: "sf-weather", patch: { maxPrice: 39 } });
    expect(decisionFingerprint(view())).not.toBe(initial);
  });
});

describe("policy preview", () => {
  it("applies drafts in display units and previews eligibility", () => {
    const { view } = harness();
    const current = view();
    const idle = previewEligibility(current);
    expect(idle.qualifiedIds.size).toBe(current.qualifiedCount);
    expect(idle.passCounts.latency).toBe(7);

    const preview = previewEligibility(current, { maxP95LatencyMs: { value: 700 } });
    expect(preview.policy.maxP95LatencyMs).toBe(700);
    expect(preview.qualifiedIds.has("cloudflare")).toBe(true);
    expect(preview.ranking[0]).toBe("cloudflare");
    expect(preview.passCounts.latency).toBe(8);
    expect(preview.reasons.modal).toBe("Data age 42 min exceeds 15 min");
  });

  it("converts weather minutes and ignores empty drafts", () => {
    const { view } = harness();
    const policy = draftPolicy(view(), { maxDataAgeMs: { value: 45 }, maxPrice: { value: null } });
    expect(policy.maxDataAgeMs).toBe(45 * 60_000);
    expect(policy.maxPrice).toBe(40);
    expect(previewEligibility(view(), { maxDataAgeMs: { value: 45 } }).qualifiedIds.has("modal")).toBe(true);
  });

  it("lists the four policy limits in form order", () => {
    expect(POLICY_FIELDS.map((field) => field.label)).toEqual([
      "Max request price",
      "Max P95 latency",
      "Max data age",
      "Min success rate",
    ]);
  });
});

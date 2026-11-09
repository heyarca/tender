import { describe, expect, it } from "vitest";

import { parseBalances, parseRecords, parseReceipt, payeeBalance } from "../payment-records";

const TX = `0x${"ab".repeat(32)}`;
const receipt = {
  txHash: TX,
  amountUsd: 0.000018,
  amountAtomic: "18",
  asset: "USDC",
  payer: "0x1111111111111111111111111111111111111111",
  payTo: "0xE2A9aA9271235E39394865e6e9b3d614e98F5f5D",
  providerId: "together",
  providerName: "Together",
  latency_ms: 140,
  data_age_ms: 360_000,
  network: "base-sepolia",
  explorerUrl: `https://sepolia.basescan.org/tx/${TX}`,
  price_usd: 0.000018,
  settled_usd: 0.000018,
  settled_atomic: "18",
};

describe("parseReceipt", () => {
  it("accepts a complete receipt and rejects tampered ones", () => {
    expect(parseReceipt(receipt)).toEqual(receipt);
    expect(parseReceipt({ ...receipt, txHash: "0x12" })).toBeNull();
    expect(parseReceipt({ ...receipt, explorerUrl: "https://example.com/tx" })).toBeNull();
    expect(parseReceipt({ ...receipt, settled_atomic: "1.5" })).toBeNull();
    expect(parseReceipt(null)).toBeNull();
  });
});

describe("parseRecords", () => {
  it("restores valid records per market, deduplicated and capped", () => {
    const entry = { id: TX, at: 1_000, receipt, summary: "61°F Overcast" };
    const other = { ...entry, receipt: { ...receipt, txHash: `0x${"cd".repeat(32)}` } };
    const third = { ...entry, receipt: { ...receipt, txHash: `0x${"ef".repeat(32)}` } };
    const raw = JSON.stringify({ version: 1, records: { "sf-weather": [entry, entry, other, third, { junk: true }], unknown: [entry] } });
    const parsed = parseRecords(raw, 2);
    expect(Object.keys(parsed)).toEqual(["sf-weather"]);
    expect(parsed["sf-weather"]?.map((record) => record.id)).toEqual([TX, `0x${"cd".repeat(32)}`]);
    expect(parsed["sf-weather"]?.[0]).toMatchObject({ marketId: "sf-weather", at: 1_000, summary: "61°F Overcast" });
  });

  it("ignores missing, malformed, and other-version data", () => {
    expect(parseRecords(null, 20)).toEqual({});
    expect(parseRecords("{", 20)).toEqual({});
    expect(parseRecords(JSON.stringify({ version: 2, records: {} }), 20)).toEqual({});
  });
});

describe("parseBalances", () => {
  const payer = { id: "payer", address: "0x1111111111111111111111111111111111111111", amountAtomic: "19999820", amountUsd: "19.99982" };
  const together = { id: "together", address: receipt.payTo, amountAtomic: "412", amountUsd: "0.000412" };
  const body = { network: "base-sepolia", asset: "USDC", tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", payer, payees: [together] };

  it("parses the balances response", () => {
    const parsed = parseBalances(body);
    expect(parsed?.payer).toEqual(payer);
    expect(payeeBalance(parsed, "together")).toEqual(together);
    expect(payeeBalance(parsed, "deepinfra")).toBeNull();
    expect(payeeBalance(null, "together")).toBeNull();
  });

  it("accepts a missing payer and rejects malformed balances", () => {
    expect(parseBalances({ ...body, payer: null })?.payer).toBeNull();
    expect(parseBalances({ ...body, payer: { ...payer, amountAtomic: "-1" } })).toBeNull();
    expect(parseBalances({ ...body, payees: [{ ...together, address: "nope" }] })).toBeNull();
    expect(parseBalances({ error: "Unable to read Base Sepolia USDC balances" })).toBeNull();
  });
});

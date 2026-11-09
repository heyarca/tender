import type { Address } from "viem";

// Base Sepolia receiving addresses. Private keys were discarded at generation.
export const PAYEES = {
  "together": "0xE2A9aA9271235E39394865e6e9b3d614e98F5f5D",
  "deepinfra": "0x463160c63D9306F684CE88DB65fF458A4Fe1b445",
  "fireworks": "0x1264A09c0571E7c0fBDA34834f05C0940c779eb7",
  "digitalocean": "0xc75048d5359Dd110F01893126E5f08Acf46Acc6c",
  "cloudflare": "0x609251576A14E2d2846c1C6e9Fc91Ad4C510F46E",
  "modal": "0x008b2b5D6eF57aa695b461554836D7B620944928",
  "mistral": "0x8df3743Ee10307078e90dBCafD2DE9fF39931aCA",
  "nebius": "0x70b6d2d285067FF814F9540c7624c319B0174513",
  "the-zone-bio": "0x1Bb3d259099D488CC31a65c187cd5bB66eB60FB8",
  "arca-labs": "0xB06CfF04b3C968cb3bacD984F5151E8096fa4992",
  "coreweave": "0xa4e90a3f2c7e957AF2364e6Fc6246F9a59411D19",
  "baseten": "0x7025008bC0b9A9656d4A6Cb0A2563CD0120Ec930",
  "novita": "0xc2Fe417D70eBF6607daA868230b0186C500c582E",
  "crusoe": "0x30f083246072da847d68B42bD77bceD4ce3dA4d7",
  "gmicloud": "0xEe0d6fEC7177cbCDf2137d75c33D61e8Bf93834e",
  "wafer": "0x183268541bEB9D4B06ed1F7eC3a9B96556C1580E",
} as const satisfies Record<string, Address>;

export type ProviderId = keyof typeof PAYEES;

export function getPayee(providerId: string): Address {
  if (!Object.hasOwn(PAYEES, providerId)) throw new Error("Unknown payment provider");
  return PAYEES[providerId as ProviderId];
}

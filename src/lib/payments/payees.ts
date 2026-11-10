import type { Address } from "viem";

// Base Sepolia receiving addresses. Private keys were discarded at generation.
export const PAYEES = {
  "fernline": "0xE2A9aA9271235E39394865e6e9b3d614e98F5f5D",
  "kitefin": "0x463160c63D9306F684CE88DB65fF458A4Fe1b445",
  "cinderlane": "0x1264A09c0571E7c0fBDA34834f05C0940c779eb7",
  "saltmarsh": "0xc75048d5359Dd110F01893126E5f08Acf46Acc6c",
  "slatework": "0x609251576A14E2d2846c1C6e9Fc91Ad4C510F46E",
  "mossgate": "0x008b2b5D6eF57aa695b461554836D7B620944928",
  "owlbridge": "0x8df3743Ee10307078e90dBCafD2DE9fF39931aCA",
  "kelpwave": "0x70b6d2d285067FF814F9540c7624c319B0174513",
  "the-zone-bio": "0x1Bb3d259099D488CC31a65c187cd5bB66eB60FB8",
  "arca-labs": "0xB06CfF04b3C968cb3bacD984F5151E8096fa4992",
  "bramblecore": "0xa4e90a3f2c7e957AF2364e6Fc6246F9a59411D19",
  "quarrystone": "0x7025008bC0b9A9656d4A6Cb0A2563CD0120Ec930",
  "brindlewood": "0xc2Fe417D70eBF6607daA868230b0186C500c582E",
  "hollowbrook": "0x30f083246072da847d68B42bD77bceD4ce3dA4d7",
  "basaltine": "0xEe0d6fEC7177cbCDf2137d75c33D61e8Bf93834e",
  "heronway": "0x183268541bEB9D4B06ed1F7eC3a9B96556C1580E",
  "tapeline": "0xc33D002Be4c006cb185E4E6E67e5f37Ca5f0e87E",
  "futian-parts": "0xa9DD535bFc79e1a6da9093B6e611Fd123F8496D0",
  "pearl-river": "0x4f8aa72D28E0Ea95Deeb1D5f8667E81dbd1708ab",
  "reelyard": "0xAd4D2D8c41Aa89d86ca408e83c8f320E25fFDE84",
  "bom-scout": "0x9E5331B701cf21DD333600c12f4C8C615256446C",
  "salar-index": "0xF452cF0A44d34834514a57a7875e8B348aA7449F",
  "cathode-wire": "0xF115d4BC3335d228e690243dB5305Cc1Ed4F2CFB",
  "yichun-desk": "0x90836eF4E97655268f7dFb3da1D891B2c836F037",
  "metal-ledger": "0xA86f88d6eC60d104f2CB4Fc3F2b644972177e201",
  "harbor-quote": "0xeaA286B19514036cfCBE86008DFFcFEA56d6d812",
  "lane-signal": "0x65f8986C232815ae5e32ac920d65146B08b57494",
  "box-index": "0x51cB5D743fe0A128Da97ee25549F84903FC20f65",
  "pacific-lanes": "0xc63857e60C9a4B9E3BD3cBA057eAE90A8EE0e739",
} as const satisfies Record<string, Address>;

export type ProviderId = keyof typeof PAYEES;

export function getPayee(providerId: string): Address {
  if (!Object.hasOwn(PAYEES, providerId)) throw new Error("Unknown payment provider");
  return PAYEES[providerId as ProviderId];
}

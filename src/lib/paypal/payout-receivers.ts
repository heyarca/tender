/**
 * PayPal receiver email per provider id. Filled with the PayPal sandbox receiver accounts.
 * Providers without a receiver are not paid; their earnings stay unpaid until one is added.
 */
export const PAYOUT_RECEIVERS: Readonly<Record<string, string>> = {
  "the-zone-bio": "tender-the-zone-bio-0003@personal.example.com",
  "arca-labs": "tender-arca-labs-0003@personal.example.com",
  "fernline": "tender-fernline-0003@personal.example.com",
  "kitefin": "tender-kitefin-0003@personal.example.com",
  "cinderlane": "tender-cinderlane-0003@personal.example.com",
  "bramblecore": "tender-bramblecore-0003@personal.example.com",
  "saltmarsh": "tender-saltmarsh-0003@personal.example.com",
  "quarrystone": "tender-quarrystone-0003@personal.example.com",
  "tapeline": "tender-tapeline-0003@personal.example.com",
  "futian-parts": "tender-futian-parts-0003@personal.example.com",
  "yichun-desk": "tender-yichun-desk-0003@personal.example.com",
  "salar-index": "tender-salar-index-0003@personal.example.com",
  "harbor-quote": "tender-harbor-quote-0003@personal.example.com",
  "lane-signal": "tender-lane-signal-0003@personal.example.com",
  "pacific-lanes": "tender-pacific-lanes-0003@personal.example.com",
};

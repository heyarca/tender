# Provider logos

Every provider in Tender's market data is fictional, except **Arca Labs** and **THE ZONE BIO**, which are
our own companies. Names and logos identify providers inside Tender's market data; they are not
partnership claims.

The fictional providers' logos are original marks drawn for Tender. Each one is a 64×64 SVG: a colored
rounded square with a simple white shape and no text, so it stays legible in the 16–28 px provider tiles
(`src/components/ui/provider-logo.tsx`).

| id | name | file | color | mark |
|---|---|---|---|---|
| `arca-labs` | Arca Labs | `/providers/arca-labs.png` | — | Arca Labs logo |
| `the-zone-bio` | THE ZONE BIO | `/providers/the-zone-bio.jpg` | — | THE ZONE BIO logo |
| `basaltine` | Basaltine | `/providers/basaltine.svg` | `#4338CA` | basalt column |
| `bramblecore` | Bramblecore | `/providers/bramblecore.svg` | `#BE185D` | berry cluster |
| `brindlewood` | Brindlewood | `/providers/brindlewood.svg` | `#111827` | brindle stripes |
| `cinderlane` | Cinderlane | `/providers/cinderlane.svg` | `#DC2626` | ember drop |
| `fernline` | Fernline | `/providers/fernline.svg` | `#15803D` | fern frond |
| `heronway` | Heronway | `/providers/heronway.svg` | `#E11D48` | forward chevron |
| `hollowbrook` | Hollowbrook | `/providers/hollowbrook.svg` | `#1E3A8A` | ring and stream |
| `kelpwave` | Kelpwave | `/providers/kelpwave.svg` | `#0D9488` | two waves |
| `kitefin` | Kitefin | `/providers/kitefin.svg` | `#2563EB` | kite |
| `mossgate` | Mossgate | `/providers/mossgate.svg` | `#7C3AED` | gate arch |
| `owlbridge` | Owlbridge | `/providers/owlbridge.svg` | `#92400E` | owl eyes and beak |
| `quarrystone` | Quarrystone | `/providers/quarrystone.svg` | `#57534E` | stacked blocks |
| `saltmarsh` | Saltmarsh | `/providers/saltmarsh.svg` | `#0284C7` | salt crystal |
| `slatework` | Slatework | `/providers/slatework.svg` | `#475569` | stacked slabs |

Providers without a logo file show the first letter of their name: BOM Scout, Box Index, Cathode Wire, Futian Parts Index, Harbor Quote, Lane Signal, Metal Ledger, Pacific Lanes, Pearl River Components, Reelyard Brokers, Salar Index, Tapeline Parts, Yichun Desk.

To add a provider, add it to `src/lib/registry/providers.ts` and, if it gets paid, give it a receiving
address in `src/lib/payments/payees.ts`. Use a fictional name, or one you own.

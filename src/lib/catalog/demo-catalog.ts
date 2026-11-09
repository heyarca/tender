import type { CatalogCategory, CatalogMarketDemo, CatalogProviderDemo } from "./types";

/**
 * Preview-only catalog data. Values, response shapes, and provider rows are
 * deterministic illustrations, not live quotes, measurements, integrations,
 * partner listings, or availability claims.
 */
const PROVIDER_IDENTITIES = [
  { id: "the-zone-bio", name: "THE ZONE BIO", logo: "/providers/the-zone-bio.jpg" },
  { id: "arca-labs", name: "Arca Labs", logo: "/providers/arca-labs.png" },
] as const;

function demoProviders(seed: number): readonly CatalogProviderDemo[] {
  return [0, 1].map((offset) => {
    const identity = PROVIDER_IDENTITIES[offset];
    return {
      ...identity,
      pricePerMillionUsd: Number((0.24 + ((seed * 17 + offset * 11) % 95) / 10).toFixed(2)),
      p95LatencyMs: 45 + ((seed * 29 + offset * 41) % 260),
      freshnessMs: 250 + ((seed * 1_907 + offset * 4_201) % 240_000),
      successRate: Number((0.997 + ((seed + offset) % 4) / 1_000).toFixed(4)),
    };
  });
}

type MarketSeed = Omit<CatalogMarketDemo, "category" | "providers">;
type CategorySeed = Omit<CatalogCategory, "markets"> & { markets: readonly MarketSeed[] };

const result = (data: Record<string, unknown>): Record<string, unknown> => data;

const CATEGORY_SEEDS = [
  {
    id: "stock-quotes", label: "Stock quotes", iconKey: "chart",
    description: "Illustrative normalized equity quote contracts for catalog exploration.",
    markets: [
      { id: "aapl-usd", name: "Apple quote", identifier: "stocks/aapl-usd", contract: 'stocks.quote({ symbol: "AAPL" })', description: "A demo US equity quote response.", sampleResult: result({ symbol: "AAPL", currency: "USD", last: 184.42, asOf: "2026-01-15T14:30:00Z" }) },
      { id: "msft-usd", name: "Microsoft quote", identifier: "stocks/msft-usd", contract: 'stocks.quote({ symbol: "MSFT" })', description: "A demo US equity quote response.", sampleResult: result({ symbol: "MSFT", currency: "USD", last: 411.08, asOf: "2026-01-15T14:30:00Z" }) },
      { id: "nvda-usd", name: "NVIDIA quote", identifier: "stocks/nvda-usd", contract: 'stocks.quote({ symbol: "NVDA" })', description: "A demo US equity quote response.", sampleResult: result({ symbol: "NVDA", currency: "USD", last: 131.28, asOf: "2026-01-15T14:30:00Z" }) },
    ],
  },
  {
    id: "commodities", label: "Commodities", iconKey: "fuel",
    description: "Illustrative spot and benchmark commodity contracts.",
    markets: [
      { id: "gold-usd", name: "Gold spot", identifier: "commodities/gold-usd", contract: 'commodities.spot({ symbol: "XAU-USD" })', description: "A demo gold spot response.", sampleResult: result({ symbol: "XAU-USD", price: 2034.6, unit: "troy_oz" }) },
      { id: "wti-usd", name: "WTI crude", identifier: "commodities/wti-usd", contract: 'commodities.spot({ symbol: "WTI-USD" })', description: "A demo WTI crude response.", sampleResult: result({ symbol: "WTI-USD", price: 74.18, unit: "barrel" }) },
      { id: "wheat-usd", name: "Wheat future", identifier: "commodities/wheat-usd", contract: 'commodities.quote({ symbol: "WHEAT" })', description: "A demo wheat benchmark response.", sampleResult: result({ symbol: "WHEAT", price: 5.82, unit: "bushel" }) },
    ],
  },
  {
    id: "flight-status", label: "Flight status", iconKey: "plane",
    description: "Illustrative flight movement and schedule status contracts.",
    markets: [
      { id: "ua1-status", name: "United 1 status", identifier: "flights/ua1", contract: 'flights.status({ flight: "UA1" })', description: "A demo flight status response.", sampleResult: result({ flight: "UA1", status: "scheduled", departure: { airport: "SFO", scheduled: "2026-01-15T22:40:00Z" } }) },
      { id: "dl405-status", name: "Delta 405 status", identifier: "flights/dl405", contract: 'flights.status({ flight: "DL405" })', description: "A demo flight status response.", sampleResult: result({ flight: "DL405", status: "en_route", arrival: { airport: "JFK", estimated: "2026-01-15T20:05:00Z" } }) },
      { id: "ba178-status", name: "British Airways 178 status", identifier: "flights/ba178", contract: 'flights.status({ flight: "BA178" })', description: "A demo flight status response.", sampleResult: result({ flight: "BA178", status: "landed", arrival: { airport: "LHR", actual: "2026-01-15T13:18:00Z" } }) },
    ],
  },
  {
    id: "air-quality", label: "Air quality", iconKey: "wind",
    description: "Illustrative localized air-quality index contracts.",
    markets: [
      { id: "seoul-air", name: "Seoul air quality", identifier: "air-quality/seoul", contract: 'airQuality.current({ location: "seoul" })', description: "A demo city air-quality response.", sampleResult: result({ location: "Seoul", aqi: 61, category: "moderate", pm25: 18.4 }) },
      { id: "london-air", name: "London air quality", identifier: "air-quality/london", contract: 'airQuality.current({ location: "london" })', description: "A demo city air-quality response.", sampleResult: result({ location: "London", aqi: 34, category: "good", pm25: 8.1 }) },
      { id: "la-air", name: "Los Angeles air quality", identifier: "air-quality/los-angeles", contract: 'airQuality.current({ location: "los-angeles" })', description: "A demo city air-quality response.", sampleResult: result({ location: "Los Angeles", aqi: 72, category: "moderate", ozone: 0.061 }) },
    ],
  },
  {
    id: "sports-scores", label: "Sports scores", iconKey: "trophy",
    description: "Illustrative in-progress and completed score contracts.",
    markets: [
      { id: "nba-score", name: "NBA game score", identifier: "sports/nba/game", contract: 'sports.score({ league: "NBA", gameId: "demo-001" })', description: "A demo basketball score response.", sampleResult: result({ league: "NBA", status: "final", home: { name: "Demo Home", score: 108 }, away: { name: "Demo Away", score: 104 } }) },
      { id: "epl-score", name: "Premier League score", identifier: "sports/epl/match", contract: 'sports.score({ league: "EPL", matchId: "demo-002" })', description: "A demo football score response.", sampleResult: result({ league: "EPL", status: "live", minute: 63, home: { score: 1 }, away: { score: 1 } }) },
      { id: "mlb-score", name: "MLB game score", identifier: "sports/mlb/game", contract: 'sports.score({ league: "MLB", gameId: "demo-003" })', description: "A demo baseball score response.", sampleResult: result({ league: "MLB", status: "scheduled", startsAt: "2026-01-15T23:10:00Z" }) },
    ],
  },
  {
    id: "shipping-tracking", label: "Shipping & parcel tracking", iconKey: "package",
    description: "Illustrative package milestone and delivery estimate contracts.",
    markets: [
      { id: "ups-tracking", name: "UPS tracking", identifier: "tracking/ups", contract: 'tracking.lookup({ carrier: "ups", number: "demo" })', description: "A demo parcel tracking response.", sampleResult: result({ carrier: "ups", status: "in_transit", latestEvent: "Departed facility", eta: "2026-01-17" }) },
      { id: "fedex-tracking", name: "FedEx tracking", identifier: "tracking/fedex", contract: 'tracking.lookup({ carrier: "fedex", number: "demo" })', description: "A demo parcel tracking response.", sampleResult: result({ carrier: "fedex", status: "out_for_delivery", latestEvent: "Local vehicle", eta: "2026-01-15" }) },
      { id: "dhl-tracking", name: "DHL tracking", identifier: "tracking/dhl", contract: 'tracking.lookup({ carrier: "dhl", number: "demo" })', description: "A demo parcel tracking response.", sampleResult: result({ carrier: "dhl", status: "delivered", deliveredAt: "2026-01-14T16:20:00Z" }) },
    ],
  },
  {
    id: "traffic-travel-time", label: "Traffic & travel time", iconKey: "route",
    description: "Illustrative route distance, duration, and incident contracts.",
    markets: [
      { id: "sf-commute", name: "San Francisco commute", identifier: "traffic/sf-commute", contract: 'routes.estimate({ from: "mission", to: "soma" })', description: "A demo urban route response.", sampleResult: result({ distanceKm: 3.4, durationMinutes: 14, traffic: "moderate" }) },
      { id: "seoul-commute", name: "Seoul commute", identifier: "traffic/seoul-commute", contract: 'routes.estimate({ from: "gangnam", to: "jongno" })', description: "A demo urban route response.", sampleResult: result({ distanceKm: 11.2, durationMinutes: 38, traffic: "heavy" }) },
      { id: "london-commute", name: "London commute", identifier: "traffic/london-commute", contract: 'routes.estimate({ from: "shoreditch", to: "westminster" })', description: "A demo urban route response.", sampleResult: result({ distanceKm: 6.8, durationMinutes: 29, traffic: "light" }) },
    ],
  },
  {
    id: "geocoding", label: "Geocoding", iconKey: "map-pin",
    description: "Illustrative address, place, and reverse-geocode contracts.",
    markets: [
      { id: "address-geocode", name: "Address geocode", identifier: "geocoding/address", contract: 'geocoding.search({ query: "1600 Amphitheatre Parkway" })', description: "A demo address geocoding response.", sampleResult: result({ label: "1600 Amphitheatre Parkway", latitude: 37.422, longitude: -122.0841 }) },
      { id: "place-geocode", name: "Place search", identifier: "geocoding/place", contract: 'geocoding.search({ query: "Seoul City Hall" })', description: "A demo place search response.", sampleResult: result({ label: "Seoul City Hall", latitude: 37.5663, longitude: 126.9779 }) },
      { id: "reverse-geocode", name: "Reverse geocode", identifier: "geocoding/reverse", contract: 'geocoding.reverse({ latitude: 51.5074, longitude: -0.1278 })', description: "A demo reverse geocoding response.", sampleResult: result({ label: "Westminster, London", countryCode: "GB", postalCode: "SW1A" }) },
    ],
  },
  {
    id: "ip-intelligence", label: "IP intelligence", iconKey: "network",
    description: "Illustrative network, location, and risk-enrichment contracts.",
    markets: [
      { id: "ip-geo", name: "IP geolocation", identifier: "ip/geo", contract: 'ip.lookup({ address: "203.0.113.10" })', description: "A demo IP location response.", sampleResult: result({ address: "203.0.113.10", countryCode: "US", city: "Example City", networkType: "business" }) },
      { id: "ip-risk", name: "IP risk", identifier: "ip/risk", contract: 'ip.risk({ address: "203.0.113.10" })', description: "A demo IP risk response.", sampleResult: result({ address: "203.0.113.10", riskScore: 12, flags: ["proxy_unknown"] }) },
      { id: "ip-asn", name: "IP ASN lookup", identifier: "ip/asn", contract: 'ip.asn({ address: "203.0.113.10" })', description: "A demo ASN response.", sampleResult: result({ address: "203.0.113.10", asn: "AS64500", organization: "Example Network" }) },
    ],
  },
  {
    id: "company-data", label: "Company data", iconKey: "building",
    description: "Illustrative company profile and registry record contracts.",
    markets: [
      { id: "company-profile", name: "Company profile", identifier: "companies/profile", contract: 'companies.profile({ domain: "example.com" })', description: "A demo company profile response.", sampleResult: result({ name: "Example Company", domain: "example.com", industry: "software", employeeRange: "51-200" }) },
      { id: "company-registry", name: "Company registry", identifier: "companies/registry", contract: 'companies.registry({ jurisdiction: "US", number: "demo" })', description: "A demo registry response.", sampleResult: result({ jurisdiction: "US", status: "active", entityType: "corporation" }) },
      { id: "company-funding", name: "Company funding", identifier: "companies/funding", contract: 'companies.funding({ domain: "example.com" })', description: "A demo company funding response.", sampleResult: result({ company: "Example Company", latestRound: "series_a", announcedOn: "2025-06-01" }) },
    ],
  },
  {
    id: "contact-verification", label: "Email & phone verification", iconKey: "badge-check",
    description: "Illustrative contact deliverability and normalization contracts.",
    markets: [
      { id: "email-verify", name: "Email verification", identifier: "verification/email", contract: 'email.verify({ address: "person@example.com" })', description: "A demo email verification response.", sampleResult: result({ address: "person@example.com", status: "valid", disposable: false, normalized: "person@example.com" }) },
      { id: "phone-verify", name: "Phone verification", identifier: "verification/phone", contract: 'phone.verify({ number: "+14155550100" })', description: "A demo phone verification response.", sampleResult: result({ e164: "+14155550100", valid: true, countryCode: "US", type: "mobile" }) },
      { id: "email-risk", name: "Email risk", identifier: "verification/email-risk", contract: 'email.risk({ address: "person@example.com" })', description: "A demo email risk response.", sampleResult: result({ address: "person@example.com", risk: "low", flags: [] }) },
    ],
  },
  {
    id: "kyc-screening", label: "Sanctions & KYC screening", iconKey: "shield-check",
    description: "Illustrative screening workflow responses; not compliance advice or a live watchlist check.",
    markets: [
      { id: "sanctions-screen", name: "Sanctions screen", identifier: "kyc/sanctions", contract: 'screening.sanctions({ name: "Demo Person" })', description: "A demo sanctions workflow response.", sampleResult: result({ subject: "Demo Person", status: "no_demo_match", reviewedSources: ["demo-list"] }) },
      { id: "pep-screen", name: "PEP screen", identifier: "kyc/pep", contract: 'screening.pep({ name: "Demo Person" })', description: "A demo PEP workflow response.", sampleResult: result({ subject: "Demo Person", status: "no_demo_match", confidence: "illustrative" }) },
      { id: "kyc-document", name: "KYC document check", identifier: "kyc/document", contract: 'screening.document({ documentId: "demo" })', description: "A demo document check response.", sampleResult: result({ documentId: "demo", status: "demo_review_required", checks: ["format"] }) },
    ],
  },
  {
    id: "llm-chat", label: "LLM chat completion", iconKey: "message-square",
    description: "Illustrative text-generation request and response contracts.",
    markets: [
      { id: "chat-general", name: "General chat", identifier: "llm/chat/general", contract: 'chat.complete({ model: "demo-general", messages })', description: "A demo chat completion response.", sampleResult: result({ model: "demo-general", output: "This is a static demonstration response.", finishReason: "stop" }) },
      { id: "chat-reasoning", name: "Reasoning chat", identifier: "llm/chat/reasoning", contract: 'chat.complete({ model: "demo-reasoning", messages })', description: "A demo reasoning chat response.", sampleResult: result({ model: "demo-reasoning", output: "Static response for interface preview.", finishReason: "stop" }) },
      { id: "chat-json", name: "Structured chat", identifier: "llm/chat/json", contract: 'chat.complete({ model: "demo-json", responseFormat: "json" })', description: "A demo structured completion response.", sampleResult: result({ model: "demo-json", output: { status: "demo", answer: "Static" }, finishReason: "stop" }) },
    ],
  },
  {
    id: "embeddings", label: "Embeddings", iconKey: "layers",
    description: "Illustrative vector-embedding contracts for text and retrieval flows.",
    markets: [
      { id: "embed-general", name: "General embedding", identifier: "embeddings/general", contract: 'embeddings.create({ model: "demo-embed", input })', description: "A demo text embedding response.", sampleResult: result({ model: "demo-embed", dimensions: 3, vector: [0.12, -0.44, 0.89] }) },
      { id: "embed-multilingual", name: "Multilingual embedding", identifier: "embeddings/multilingual", contract: 'embeddings.create({ model: "demo-multilingual", input })', description: "A demo multilingual embedding response.", sampleResult: result({ model: "demo-multilingual", dimensions: 3, vector: [0.31, 0.06, -0.71] }) },
      { id: "embed-code", name: "Code embedding", identifier: "embeddings/code", contract: 'embeddings.create({ model: "demo-code", input })', description: "A demo code embedding response.", sampleResult: result({ model: "demo-code", dimensions: 3, vector: [-0.2, 0.54, 0.17] }) },
    ],
  },
  {
    id: "speech-to-text", label: "Speech to text", iconKey: "microphone",
    description: "Illustrative transcription contracts for prerecorded audio.",
    markets: [
      { id: "stt-english", name: "English transcription", identifier: "speech/transcribe/en", contract: 'speech.transcribe({ language: "en", audio })', description: "A demo English transcription response.", sampleResult: result({ text: "Static transcription example.", language: "en", durationSeconds: 3.2 }) },
      { id: "stt-korean", name: "Korean transcription", identifier: "speech/transcribe/ko", contract: 'speech.transcribe({ language: "ko", audio })', description: "A demo Korean transcription response.", sampleResult: result({ text: "Static Korean transcription example.", language: "ko", durationSeconds: 3.2 }) },
      { id: "stt-diarized", name: "Diarized transcription", identifier: "speech/transcribe/diarized", contract: 'speech.transcribe({ diarize: true, audio })', description: "A demo diarized transcription response.", sampleResult: result({ segments: [{ speaker: "speaker_0", text: "Static example." }], durationSeconds: 3.2 }) },
    ],
  },
  {
    id: "text-to-speech", label: "Text to speech", iconKey: "volume-2",
    description: "Illustrative speech-synthesis contracts for generated audio.",
    markets: [
      { id: "tts-english", name: "English voice", identifier: "speech/synthesize/en", contract: 'speech.synthesize({ voice: "demo-en", text })', description: "A demo English speech response.", sampleResult: result({ format: "mp3", voice: "demo-en", durationSeconds: 2.8 }) },
      { id: "tts-korean", name: "Korean voice", identifier: "speech/synthesize/ko", contract: 'speech.synthesize({ voice: "demo-ko", text })', description: "A demo Korean speech response.", sampleResult: result({ format: "mp3", voice: "demo-ko", durationSeconds: 2.8 }) },
      { id: "tts-stream", name: "Streaming voice", identifier: "speech/synthesize/stream", contract: 'speech.synthesize({ stream: true, text })', description: "A demo streaming speech response.", sampleResult: result({ format: "pcm", stream: true, sampleRateHz: 24000 }) },
    ],
  },
  {
    id: "image-generation", label: "Image generation", iconKey: "image",
    description: "Illustrative image-generation request and asset metadata contracts.",
    markets: [
      { id: "image-square", name: "Square image", identifier: "images/generate/square", contract: 'images.generate({ size: "1024x1024", prompt })', description: "A demo square image response.", sampleResult: result({ assetId: "demo_image_square", size: "1024x1024", format: "png" }) },
      { id: "image-landscape", name: "Landscape image", identifier: "images/generate/landscape", contract: 'images.generate({ size: "1536x1024", prompt })', description: "A demo landscape image response.", sampleResult: result({ assetId: "demo_image_landscape", size: "1536x1024", format: "png" }) },
      { id: "image-edit", name: "Image edit", identifier: "images/edit", contract: 'images.edit({ image, mask, prompt })', description: "A demo image edit response.", sampleResult: result({ assetId: "demo_image_edit", operation: "edit", format: "png" }) },
    ],
  },
  {
    id: "translation", label: "Translation", iconKey: "languages",
    description: "Illustrative text translation and language-detection contracts.",
    markets: [
      { id: "translate-en-ko", name: "English to Korean", identifier: "translation/en-ko", contract: 'translation.text({ source: "en", target: "ko", text })', description: "A demo English-to-Korean response.", sampleResult: result({ sourceLanguage: "en", targetLanguage: "ko", translation: "Static translation example." }) },
      { id: "translate-ko-en", name: "Korean to English", identifier: "translation/ko-en", contract: 'translation.text({ source: "ko", target: "en", text })', description: "A demo Korean-to-English response.", sampleResult: result({ sourceLanguage: "ko", targetLanguage: "en", translation: "Static translation example." }) },
      { id: "language-detect", name: "Language detection", identifier: "translation/detect", contract: 'translation.detect({ text })', description: "A demo language-detection response.", sampleResult: result({ language: "en", confidence: 0.99 }) },
    ],
  },
  {
    id: "ocr-document-parsing", label: "OCR & document parsing", iconKey: "file-search",
    description: "Illustrative document extraction and classification contracts.",
    markets: [
      { id: "ocr-receipt", name: "Receipt OCR", identifier: "documents/ocr/receipt", contract: 'documents.parse({ type: "receipt", file })', description: "A demo receipt parse response.", sampleResult: result({ documentType: "receipt", fields: { total: "12.34", currency: "USD" } }) },
      { id: "ocr-invoice", name: "Invoice parsing", identifier: "documents/ocr/invoice", contract: 'documents.parse({ type: "invoice", file })', description: "A demo invoice parse response.", sampleResult: result({ documentType: "invoice", fields: { invoiceNumber: "DEMO-001", total: "250.00" } }) },
      { id: "ocr-id", name: "ID document OCR", identifier: "documents/ocr/id", contract: 'documents.parse({ type: "identity_document", file })', description: "A demo identity-document parse response.", sampleResult: result({ documentType: "identity_document", fields: { documentNumber: "DEMO" }, review: "required" }) },
    ],
  },
  {
    id: "web-search-scraping", label: "Web search & scraping", iconKey: "search",
    description: "Illustrative search retrieval and page extraction contracts; no live crawl is performed.",
    markets: [
      { id: "web-search", name: "Web search", identifier: "web/search", contract: 'web.search({ query: "demo query" })', description: "A demo web search response.", sampleResult: result({ query: "demo query", results: [{ title: "Example result", url: "https://example.com" }] }) },
      { id: "web-extract", name: "Page extraction", identifier: "web/extract", contract: 'web.extract({ url: "https://example.com" })', description: "A demo page extraction response.", sampleResult: result({ url: "https://example.com", title: "Example Domain", text: "Static extracted text." }) },
      { id: "web-metadata", name: "Page metadata", identifier: "web/metadata", contract: 'web.metadata({ url: "https://example.com" })', description: "A demo page metadata response.", sampleResult: result({ url: "https://example.com", title: "Example Domain", description: "Static metadata." }) },
    ],
  },
] as const satisfies readonly CategorySeed[];

/** All catalog categories in stable display order. */
export const DEMO_CATALOG_CATEGORIES: readonly CatalogCategory[] = CATEGORY_SEEDS.map((category, categoryIndex) => ({
  id: category.id,
  label: category.label,
  description: category.description,
  iconKey: category.iconKey,
  markets: category.markets.map((market, marketIndex) => ({
    ...market,
    category: category.id,
    providers: demoProviders(categoryIndex * 3 + marketIndex),
  })),
}));

/** Alias for consumers that want the complete catalog as one value. */
export const DEMO_CATALOG = DEMO_CATALOG_CATEGORIES;

/** Category ids in deterministic display order. */
export const DEMO_CATALOG_CATEGORY_IDS = DEMO_CATALOG_CATEGORIES.map((category) => category.id);

/** Finds a category by id. */
export function getCatalogCategory(categoryId: string): CatalogCategory | undefined {
  return DEMO_CATALOG_CATEGORIES.find((category) => category.id === categoryId);
}

/** Every catalog market in stable category and display order. */
export const CATALOG_MARKETS: readonly CatalogMarketDemo[] = DEMO_CATALOG_CATEGORIES.flatMap((category) => category.markets);

/** Lists all markets, retaining category display order. */
export function listCatalogMarkets(): readonly CatalogMarketDemo[] {
  return CATALOG_MARKETS;
}

/** Finds a market by its stable id. */
export function getCatalogMarket(marketId: string): CatalogMarketDemo | undefined {
  return CATALOG_MARKETS.find((market) => market.id === marketId);
}

/** Case-insensitive search across category and market copy. */
export function searchCatalog(query: string): readonly CatalogMarketDemo[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return CATALOG_MARKETS;
  return DEMO_CATALOG_CATEGORIES.flatMap((category) =>
    category.markets.filter((market) =>
      [category.label, category.description, market.name, market.identifier, market.contract, market.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    ),
  );
}

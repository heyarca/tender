// Generated from the Tender registry design (docs/DATA-MODEL.md). Edit the data here; the engine, pages, API, and SDK read it.
import type { CategorySpec, GroupSpec } from "./types";

/** Top level of the market hierarchy, in display order. */
export const GROUPS: readonly GroupSpec[] = [
  {
    "id": "weather-environment",
    "label": "Weather & environment",
    "description": "Current conditions and environmental readings by location."
  },
  {
    "id": "market-data",
    "label": "Market data",
    "description": "Prices and quotes for physical goods, securities, currencies, and crypto."
  },
  {
    "id": "travel-logistics",
    "label": "Travel & logistics",
    "description": "Flights, freight, parcels, routes, and places."
  },
  {
    "id": "ai-models",
    "label": "AI models",
    "description": "Model inference: chat, embeddings, speech, images, translation, and documents."
  },
  {
    "id": "identity-risk",
    "label": "Identity & risk",
    "description": "Network, contact, company, and compliance checks."
  },
  {
    "id": "web-data",
    "label": "Web data",
    "description": "Search results and clean page content."
  },
  {
    "id": "sports-events",
    "label": "Sports & events",
    "description": "Live and final scores."
  }
];

/** Categories, grouped and ordered for display (crypto last within market data). */
export const CATEGORIES: readonly CategorySpec[] = [
  {
    "id": "weather",
    "groupId": "weather-environment",
    "label": "Weather",
    "description": "Current weather for a city through one normalized contract.",
    "icon": "cloud",
    "focus": [
      "freshness",
      "price"
    ]
  },
  {
    "id": "air-quality",
    "groupId": "weather-environment",
    "label": "Air quality",
    "description": "Air quality index and pollutants for a city.",
    "icon": "wind",
    "focus": [
      "freshness",
      "price"
    ]
  },
  {
    "id": "component-prices",
    "groupId": "market-data",
    "label": "Electronic components",
    "description": "Spot prices, stock, and lead times for electronic components.",
    "icon": "cpu",
    "focus": [
      "freshness",
      "price"
    ]
  },
  {
    "id": "commodities",
    "groupId": "market-data",
    "label": "Commodities",
    "description": "Spot and benchmark prices for metals, energy, agriculture, and battery materials.",
    "icon": "pickaxe",
    "focus": [
      "freshness",
      "price"
    ]
  },
  {
    "id": "stock-quotes",
    "groupId": "market-data",
    "label": "Stock quotes",
    "description": "Last price, bid and ask, and volume for listed equities.",
    "icon": "chart-line",
    "focus": [
      "freshness",
      "latency"
    ]
  },
  {
    "id": "currencies",
    "groupId": "market-data",
    "label": "Currencies",
    "description": "Foreign exchange spot rates.",
    "icon": "euro",
    "focus": [
      "freshness",
      "latency"
    ]
  },
  {
    "id": "crypto-prices",
    "groupId": "market-data",
    "label": "Crypto prices",
    "description": "Crypto spot prices with one shared price definition.",
    "icon": "bitcoin",
    "focus": [
      "freshness",
      "latency"
    ]
  },
  {
    "id": "flight-status",
    "groupId": "travel-logistics",
    "label": "Flight status",
    "description": "Departure, arrival, gate, and delay for a flight.",
    "icon": "plane",
    "focus": [
      "freshness",
      "latency"
    ]
  },
  {
    "id": "freight-rates",
    "groupId": "travel-logistics",
    "label": "Freight rates",
    "description": "Spot container rates for a shipping lane.",
    "icon": "ship",
    "focus": [
      "freshness",
      "price"
    ]
  },
  {
    "id": "parcel-tracking",
    "groupId": "travel-logistics",
    "label": "Parcel tracking",
    "description": "Delivery status and estimated arrival by carrier.",
    "icon": "package",
    "focus": [
      "freshness",
      "price"
    ]
  },
  {
    "id": "traffic",
    "groupId": "travel-logistics",
    "label": "Traffic & travel time",
    "description": "Travel time and congestion between two points.",
    "icon": "route",
    "focus": [
      "freshness",
      "latency"
    ]
  },
  {
    "id": "geocoding",
    "groupId": "travel-logistics",
    "label": "Geocoding",
    "description": "Addresses to coordinates and back.",
    "icon": "map-pin",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "llm-chat",
    "groupId": "ai-models",
    "label": "LLM chat",
    "description": "Chat completions by model class.",
    "icon": "message-square",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "embeddings",
    "groupId": "ai-models",
    "label": "Embeddings",
    "description": "Text to vectors.",
    "icon": "layers",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "speech-to-text",
    "groupId": "ai-models",
    "label": "Speech to text",
    "description": "Transcription by language.",
    "icon": "mic",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "text-to-speech",
    "groupId": "ai-models",
    "label": "Text to speech",
    "description": "Speech synthesis by voice.",
    "icon": "volume-2",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "image-generation",
    "groupId": "ai-models",
    "label": "Image generation",
    "description": "Image generation and editing by size.",
    "icon": "image",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "translation",
    "groupId": "ai-models",
    "label": "Translation",
    "description": "Text translation by language pair.",
    "icon": "languages",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "document-parsing",
    "groupId": "ai-models",
    "label": "OCR & documents",
    "description": "Receipts, invoices, and IDs to structured fields.",
    "icon": "file-search",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "ip-intelligence",
    "groupId": "identity-risk",
    "label": "IP intelligence",
    "description": "Location, network, and risk for an IP address.",
    "icon": "network",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "contact-verification",
    "groupId": "identity-risk",
    "label": "Email & phone verification",
    "description": "Deliverability, line type, and risk for contacts.",
    "icon": "badge-check",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "kyc-screening",
    "groupId": "identity-risk",
    "label": "Sanctions & KYC",
    "description": "Watchlist and document screening.",
    "icon": "shield-check",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "company-data",
    "groupId": "identity-risk",
    "label": "Company data",
    "description": "Firmographics, funding, and registry records.",
    "icon": "building",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "web-search",
    "groupId": "web-data",
    "label": "Web search & scraping",
    "description": "Search results and clean content from URLs.",
    "icon": "search",
    "focus": [
      "latency",
      "price"
    ]
  },
  {
    "id": "sports-scores",
    "groupId": "sports-events",
    "label": "Sports scores",
    "description": "Live and final scores by league.",
    "icon": "trophy",
    "focus": [
      "freshness",
      "latency"
    ]
  }
];

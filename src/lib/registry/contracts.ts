// Generated from the Tender registry design (docs/DATA-MODEL.md). Edit the data here; the engine, pages, API, and SDK read it.
import type { ContractSpec } from "./types";

/** Normalized APIs. HTTP path: /api/v1/{namespace}/{action}. */
export const CONTRACTS: readonly ContractSpec[] = [
  {
    "id": "weather.current",
    "label": "Current weather",
    "description": "Current conditions for a city: temperature, sky, wind, and humidity.",
    "params": [
      {
        "key": "location",
        "label": "Location",
        "type": "string",
        "example": "san-francisco"
      }
    ],
    "output": [
      {
        "key": "location.name",
        "label": "Location",
        "type": "string"
      },
      {
        "key": "observedAt",
        "label": "Observed at",
        "type": "timestamp"
      },
      {
        "key": "temperatureF",
        "label": "Temperature",
        "type": "number",
        "unit": "°F",
        "primary": true,
        "series": true
      },
      {
        "key": "feelsLikeF",
        "label": "Feels like",
        "type": "number",
        "unit": "°F"
      },
      {
        "key": "condition",
        "label": "Condition",
        "type": "string"
      },
      {
        "key": "humidityPct",
        "label": "Humidity",
        "type": "percent",
        "unit": "%"
      },
      {
        "key": "windMph",
        "label": "Wind",
        "type": "number",
        "unit": "mph"
      },
      {
        "key": "windDirection",
        "label": "Wind direction",
        "type": "string"
      },
      {
        "key": "pressureHpa",
        "label": "Pressure",
        "type": "number",
        "unit": "hPa"
      },
      {
        "key": "visibilityMi",
        "label": "Visibility",
        "type": "number",
        "unit": "mi"
      },
      {
        "key": "dewPointF",
        "label": "Dew point",
        "type": "number",
        "unit": "°F"
      },
      {
        "key": "cloudCoverPct",
        "label": "Cloud cover",
        "type": "percent",
        "unit": "%"
      }
    ],
    "freshness": {
      "basis": "observed",
      "label": "Observation age",
      "unit": "min"
    },
    "resultView": "weather",
    "sample": {
      "location": {
        "name": "San Francisco, CA"
      },
      "observedAt": "2026-11-09T18:24:04Z",
      "temperatureF": 61.2,
      "feelsLikeF": 60.3,
      "condition": "Overcast",
      "humidityPct": 87,
      "windMph": 9,
      "windDirection": "W",
      "pressureHpa": 1018,
      "visibilityMi": 9.4,
      "dewPointF": 57.2,
      "cloudCoverPct": 100
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "airQuality.current",
    "label": "Current air quality",
    "description": "Air quality index, category, and pollutant levels for a city.",
    "params": [
      {
        "key": "location",
        "label": "Location",
        "type": "string",
        "example": "seoul"
      }
    ],
    "output": [
      {
        "key": "location",
        "label": "Location",
        "type": "string"
      },
      {
        "key": "aqi",
        "label": "AQI",
        "type": "integer",
        "unit": "US AQI",
        "primary": true,
        "series": true
      },
      {
        "key": "category",
        "label": "Category",
        "type": "enum",
        "values": [
          "good",
          "moderate",
          "unhealthy-sensitive",
          "unhealthy",
          "very-unhealthy",
          "hazardous"
        ]
      },
      {
        "key": "dominantPollutant",
        "label": "Main pollutant",
        "type": "string"
      },
      {
        "key": "pm25",
        "label": "PM2.5",
        "type": "number",
        "unit": "µg/m³"
      },
      {
        "key": "pm10",
        "label": "PM10",
        "type": "number",
        "unit": "µg/m³"
      },
      {
        "key": "ozone",
        "label": "Ozone",
        "type": "number",
        "unit": "ppm"
      },
      {
        "key": "observedAt",
        "label": "Observed at",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "observed",
      "label": "Observation age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "location": "Seoul",
      "aqi": 61,
      "category": "moderate",
      "dominantPollutant": "pm25",
      "pm25": 18.4,
      "pm10": 31.0,
      "ozone": 0.031,
      "observedAt": "2026-11-09T18:00:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "prices.spot",
    "label": "Spot price",
    "description": "Spot mid price for a currency or crypto pair, with the same price definition across providers.",
    "params": [
      {
        "key": "pair",
        "label": "Pair",
        "type": "string",
        "example": "BTC-USD"
      }
    ],
    "output": [
      {
        "key": "pair",
        "label": "Pair",
        "type": "string"
      },
      {
        "key": "priceUsd",
        "label": "Price",
        "type": "money",
        "unit": "USD",
        "primary": true,
        "series": true
      },
      {
        "key": "changeUsd",
        "label": "Change vs previous request",
        "type": "money",
        "unit": "USD",
        "optional": true
      },
      {
        "key": "sourceTimestamp",
        "label": "Source timestamp",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "price",
    "sample": {
      "pair": "BTC-USD",
      "priceUsd": 75231.18,
      "changeUsd": 4.62,
      "sourceTimestamp": "2026-11-09T18:29:56.786Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "stocks.quote",
    "label": "Stock quote",
    "description": "Last trade, bid and ask, and session volume for a listed equity.",
    "params": [
      {
        "key": "symbol",
        "label": "Symbol",
        "type": "string",
        "example": "AAPL"
      }
    ],
    "output": [
      {
        "key": "symbol",
        "label": "Symbol",
        "type": "string"
      },
      {
        "key": "last",
        "label": "Last",
        "type": "money",
        "unit": "USD",
        "primary": true,
        "series": true
      },
      {
        "key": "bid",
        "label": "Bid",
        "type": "money",
        "unit": "USD"
      },
      {
        "key": "ask",
        "label": "Ask",
        "type": "money",
        "unit": "USD"
      },
      {
        "key": "volume",
        "label": "Volume",
        "type": "integer",
        "unit": "shares"
      },
      {
        "key": "exchange",
        "label": "Exchange",
        "type": "string"
      },
      {
        "key": "asOf",
        "label": "As of",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Quote age",
      "unit": "ms"
    },
    "resultView": "price",
    "sample": {
      "symbol": "AAPL",
      "last": 228.42,
      "bid": 228.4,
      "ask": 228.44,
      "volume": 41250000,
      "exchange": "NASDAQ",
      "asOf": "2026-11-09T18:29:55Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "commodities.spot",
    "label": "Commodity price",
    "description": "Spot or benchmark price for a commodity in its trading unit.",
    "params": [
      {
        "key": "symbol",
        "label": "Symbol",
        "type": "string",
        "example": "XAU-USD"
      }
    ],
    "output": [
      {
        "key": "symbol",
        "label": "Symbol",
        "type": "string"
      },
      {
        "key": "price",
        "label": "Price",
        "type": "money",
        "unit": "USD",
        "primary": true,
        "series": true
      },
      {
        "key": "unit",
        "label": "Unit",
        "type": "string"
      },
      {
        "key": "benchmark",
        "label": "Benchmark",
        "type": "string"
      },
      {
        "key": "asOf",
        "label": "As of",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "price",
    "sample": {
      "symbol": "XAU-USD",
      "price": 2634.6,
      "unit": "troy oz",
      "benchmark": "Spot",
      "asOf": "2026-11-09T18:25:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "components.price",
    "label": "Component price",
    "description": "Spot price, stock, and lead time for an electronic component part in a market.",
    "params": [
      {
        "key": "part",
        "label": "Part",
        "type": "string",
        "example": "MLCC-0402-100NF"
      },
      {
        "key": "market",
        "label": "Market",
        "type": "string",
        "example": "huaqiangbei"
      }
    ],
    "output": [
      {
        "key": "part",
        "label": "Part",
        "type": "string"
      },
      {
        "key": "spec",
        "label": "Specification",
        "type": "string"
      },
      {
        "key": "price",
        "label": "Price",
        "type": "money",
        "unit": "USD",
        "primary": true,
        "series": true
      },
      {
        "key": "unit",
        "label": "Unit",
        "type": "string"
      },
      {
        "key": "stockReels",
        "label": "Stock",
        "type": "integer",
        "unit": "reels"
      },
      {
        "key": "leadTimeWeeks",
        "label": "Lead time",
        "type": "integer",
        "unit": "weeks"
      },
      {
        "key": "market",
        "label": "Market",
        "type": "string"
      },
      {
        "key": "asOf",
        "label": "As of",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Quote age",
      "unit": "min"
    },
    "resultView": "price",
    "sample": {
      "part": "MLCC-0402-100NF",
      "spec": "0402 100nF X7R 16V",
      "price": 21.4,
      "unit": "per 10k reel",
      "stockReels": 120,
      "leadTimeWeeks": 6,
      "market": "Huaqiangbei, Shenzhen",
      "asOf": "2026-11-09T17:40:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "freight.rate",
    "label": "Freight rate",
    "description": "Spot container rate and transit time for a shipping lane.",
    "params": [
      {
        "key": "origin",
        "label": "Origin",
        "type": "string",
        "example": "CNSHA"
      },
      {
        "key": "destination",
        "label": "Destination",
        "type": "string",
        "example": "USLAX"
      },
      {
        "key": "container",
        "label": "Container",
        "type": "string",
        "example": "40ft"
      }
    ],
    "output": [
      {
        "key": "lane",
        "label": "Lane",
        "type": "string"
      },
      {
        "key": "container",
        "label": "Container",
        "type": "string"
      },
      {
        "key": "rateUsd",
        "label": "Rate",
        "type": "money",
        "unit": "USD",
        "primary": true,
        "series": true
      },
      {
        "key": "unit",
        "label": "Unit",
        "type": "string"
      },
      {
        "key": "transitDays",
        "label": "Transit time",
        "type": "integer",
        "unit": "days"
      },
      {
        "key": "asOf",
        "label": "As of",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Rate age",
      "unit": "min"
    },
    "resultView": "price",
    "sample": {
      "lane": "Shanghai → Los Angeles",
      "container": "40ft",
      "rateUsd": 2318.4,
      "unit": "per FEU",
      "transitDays": 16,
      "asOf": "2026-11-09T12:00:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "flights.status",
    "label": "Flight status",
    "description": "Departure, arrival, gate, and delay for a flight today.",
    "params": [
      {
        "key": "flight",
        "label": "Flight",
        "type": "string",
        "example": "UA1"
      }
    ],
    "output": [
      {
        "key": "flight",
        "label": "Flight",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "enum",
        "primary": true,
        "values": [
          "scheduled",
          "boarding",
          "departed",
          "en-route",
          "landed",
          "delayed",
          "cancelled"
        ]
      },
      {
        "key": "departure.airport",
        "label": "From",
        "type": "string"
      },
      {
        "key": "departure.scheduled",
        "label": "Scheduled departure",
        "type": "timestamp"
      },
      {
        "key": "arrival.airport",
        "label": "To",
        "type": "string"
      },
      {
        "key": "arrival.estimated",
        "label": "Estimated arrival",
        "type": "timestamp"
      },
      {
        "key": "gate",
        "label": "Gate",
        "type": "string"
      },
      {
        "key": "delayMinutes",
        "label": "Delay",
        "type": "integer",
        "unit": "min",
        "series": true
      },
      {
        "key": "updatedAt",
        "label": "Updated at",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Status age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "flight": "UA1",
      "status": "scheduled",
      "departure": {
        "airport": "SFO",
        "scheduled": "2026-11-09T22:40:00Z"
      },
      "arrival": {
        "airport": "SIN",
        "estimated": "2026-11-11T08:55:00Z"
      },
      "gate": "G98",
      "delayMinutes": 0,
      "updatedAt": "2026-11-09T18:20:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "tracking.lookup",
    "label": "Parcel tracking",
    "description": "Latest status, location, and delivery estimate for a parcel.",
    "params": [
      {
        "key": "carrier",
        "label": "Carrier",
        "type": "string",
        "example": "ups"
      },
      {
        "key": "number",
        "label": "Tracking number",
        "type": "string",
        "example": "1Z999AA10123456784"
      }
    ],
    "output": [
      {
        "key": "carrier",
        "label": "Carrier",
        "type": "string"
      },
      {
        "key": "trackingNumber",
        "label": "Tracking number",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "enum",
        "primary": true,
        "values": [
          "label-created",
          "in-transit",
          "out-for-delivery",
          "delivered",
          "exception"
        ]
      },
      {
        "key": "latestEvent",
        "label": "Latest event",
        "type": "string"
      },
      {
        "key": "location",
        "label": "Location",
        "type": "string"
      },
      {
        "key": "eta",
        "label": "Estimated delivery",
        "type": "date",
        "optional": true
      },
      {
        "key": "updatedAt",
        "label": "Updated at",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Event age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "carrier": "UPS",
      "trackingNumber": "1Z999AA10123456784",
      "status": "in-transit",
      "latestEvent": "Departed facility",
      "location": "Louisville, KY",
      "eta": "2026-11-12",
      "updatedAt": "2026-11-09T15:10:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "routes.estimate",
    "label": "Travel time",
    "description": "Distance, travel time, and congestion between two points.",
    "params": [
      {
        "key": "from",
        "label": "From",
        "type": "string",
        "example": "sf-ferry-building"
      },
      {
        "key": "to",
        "label": "To",
        "type": "string",
        "example": "sf-caltrain"
      }
    ],
    "output": [
      {
        "key": "from",
        "label": "From",
        "type": "string"
      },
      {
        "key": "to",
        "label": "To",
        "type": "string"
      },
      {
        "key": "durationMinutes",
        "label": "Travel time",
        "type": "integer",
        "unit": "min",
        "primary": true,
        "series": true
      },
      {
        "key": "distanceKm",
        "label": "Distance",
        "type": "number",
        "unit": "km"
      },
      {
        "key": "traffic",
        "label": "Traffic",
        "type": "enum",
        "values": [
          "light",
          "moderate",
          "heavy"
        ]
      },
      {
        "key": "updatedAt",
        "label": "Updated at",
        "type": "timestamp"
      }
    ],
    "freshness": {
      "basis": "observed",
      "label": "Traffic age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "from": "Ferry Building",
      "to": "4th & King Caltrain",
      "durationMinutes": 14,
      "distanceKm": 3.4,
      "traffic": "moderate",
      "updatedAt": "2026-11-09T18:28:00Z"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "geocoding.search",
    "label": "Geocode",
    "description": "An address or place name to coordinates.",
    "params": [
      {
        "key": "query",
        "label": "Query",
        "type": "string",
        "example": "1600 Amphitheatre Parkway"
      }
    ],
    "output": [
      {
        "key": "label",
        "label": "Match",
        "type": "string",
        "primary": true
      },
      {
        "key": "latitude",
        "label": "Latitude",
        "type": "number"
      },
      {
        "key": "longitude",
        "label": "Longitude",
        "type": "number"
      },
      {
        "key": "countryCode",
        "label": "Country",
        "type": "string"
      },
      {
        "key": "confidence",
        "label": "Confidence",
        "type": "percent",
        "unit": "%"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "label": "1600 Amphitheatre Parkway, Mountain View, CA",
      "latitude": 37.422,
      "longitude": -122.0841,
      "countryCode": "US",
      "confidence": 98
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "geocoding.reverse",
    "label": "Reverse geocode",
    "description": "Coordinates to the nearest address.",
    "params": [
      {
        "key": "lat",
        "label": "Latitude",
        "type": "number",
        "example": "51.5007"
      },
      {
        "key": "lon",
        "label": "Longitude",
        "type": "number",
        "example": "-0.1246"
      }
    ],
    "output": [
      {
        "key": "label",
        "label": "Address",
        "type": "string",
        "primary": true
      },
      {
        "key": "postalCode",
        "label": "Postal code",
        "type": "string"
      },
      {
        "key": "countryCode",
        "label": "Country",
        "type": "string"
      },
      {
        "key": "latitude",
        "label": "Latitude",
        "type": "number"
      },
      {
        "key": "longitude",
        "label": "Longitude",
        "type": "number"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "label": "Westminster, London SW1A 0AA",
      "postalCode": "SW1A 0AA",
      "countryCode": "GB",
      "latitude": 51.5007,
      "longitude": -0.1246
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "chat.complete",
    "label": "Chat completion",
    "description": "A chat completion from a model class.",
    "params": [
      {
        "key": "model",
        "label": "Model class",
        "type": "enum",
        "example": "general",
        "values": [
          "general",
          "reasoning",
          "json"
        ]
      }
    ],
    "output": [
      {
        "key": "model",
        "label": "Model class",
        "type": "string"
      },
      {
        "key": "output",
        "label": "Output",
        "type": "string",
        "primary": true
      },
      {
        "key": "finishReason",
        "label": "Finish reason",
        "type": "enum",
        "values": [
          "stop",
          "length",
          "tool-calls"
        ]
      },
      {
        "key": "inputTokens",
        "label": "Input tokens",
        "type": "integer"
      },
      {
        "key": "outputTokens",
        "label": "Output tokens",
        "type": "integer"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "model": "general",
      "output": "Tender routed this request to the provider that met your latency and price limits.",
      "finishReason": "stop",
      "inputTokens": 42,
      "outputTokens": 18
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "embeddings.create",
    "label": "Embeddings",
    "description": "Text to a vector from an embedding model class.",
    "params": [
      {
        "key": "model",
        "label": "Model class",
        "type": "enum",
        "example": "general",
        "values": [
          "general",
          "multilingual",
          "code"
        ]
      }
    ],
    "output": [
      {
        "key": "model",
        "label": "Model class",
        "type": "string"
      },
      {
        "key": "dimensions",
        "label": "Dimensions",
        "type": "integer",
        "primary": true
      },
      {
        "key": "vector",
        "label": "Vector (first values)",
        "type": "list"
      },
      {
        "key": "inputTokens",
        "label": "Input tokens",
        "type": "integer"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "model": "general",
      "dimensions": 1024,
      "vector": [
        0.0123,
        -0.0441,
        0.0892,
        0.0157
      ],
      "inputTokens": 12
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "speech.transcribe",
    "label": "Transcription",
    "description": "Speech audio to text in a language.",
    "params": [
      {
        "key": "language",
        "label": "Language",
        "type": "string",
        "example": "en"
      }
    ],
    "output": [
      {
        "key": "text",
        "label": "Transcript",
        "type": "string",
        "primary": true
      },
      {
        "key": "language",
        "label": "Language",
        "type": "string"
      },
      {
        "key": "durationSeconds",
        "label": "Audio length",
        "type": "number",
        "unit": "s"
      },
      {
        "key": "speakers",
        "label": "Speakers",
        "type": "integer",
        "optional": true
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "text": "Move my weather requests to the cheapest provider under 300 milliseconds.",
      "language": "en",
      "durationSeconds": 3.2,
      "speakers": 1
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "speech.synthesize",
    "label": "Speech synthesis",
    "description": "Text to speech audio with a voice.",
    "params": [
      {
        "key": "voice",
        "label": "Voice",
        "type": "string",
        "example": "en-neutral"
      }
    ],
    "output": [
      {
        "key": "voice",
        "label": "Voice",
        "type": "string"
      },
      {
        "key": "audioUrl",
        "label": "Audio",
        "type": "url",
        "primary": true
      },
      {
        "key": "format",
        "label": "Format",
        "type": "string"
      },
      {
        "key": "durationSeconds",
        "label": "Length",
        "type": "number",
        "unit": "s"
      },
      {
        "key": "sampleRateHz",
        "label": "Sample rate",
        "type": "integer",
        "unit": "Hz"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "voice": "en-neutral",
      "audioUrl": "https://tender.heyarca.app/audio/sample.mp3",
      "format": "mp3",
      "durationSeconds": 2.8,
      "sampleRateHz": 24000
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "images.generate",
    "label": "Image generation",
    "description": "A prompt to an image at a size.",
    "params": [
      {
        "key": "size",
        "label": "Size",
        "type": "string",
        "example": "1024x1024"
      }
    ],
    "output": [
      {
        "key": "imageUrl",
        "label": "Image",
        "type": "url",
        "primary": true
      },
      {
        "key": "size",
        "label": "Size",
        "type": "string"
      },
      {
        "key": "format",
        "label": "Format",
        "type": "string"
      },
      {
        "key": "seed",
        "label": "Seed",
        "type": "integer"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "imageUrl": "https://tender.heyarca.app/images/sample.png",
      "size": "1024x1024",
      "format": "png",
      "seed": 4417
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "images.edit",
    "label": "Image editing",
    "description": "An image and an instruction to an edited image.",
    "params": [
      {
        "key": "operation",
        "label": "Operation",
        "type": "enum",
        "example": "inpaint",
        "values": [
          "inpaint",
          "outpaint",
          "remove-background"
        ]
      }
    ],
    "output": [
      {
        "key": "imageUrl",
        "label": "Image",
        "type": "url",
        "primary": true
      },
      {
        "key": "operation",
        "label": "Operation",
        "type": "string"
      },
      {
        "key": "format",
        "label": "Format",
        "type": "string"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "imageUrl": "https://tender.heyarca.app/images/edited.png",
      "operation": "inpaint",
      "format": "png"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "translation.text",
    "label": "Translation",
    "description": "Text translated from a source language to a target language.",
    "params": [
      {
        "key": "source",
        "label": "Source language",
        "type": "string",
        "example": "en"
      },
      {
        "key": "target",
        "label": "Target language",
        "type": "string",
        "example": "ko"
      }
    ],
    "output": [
      {
        "key": "translation",
        "label": "Translation",
        "type": "string",
        "primary": true
      },
      {
        "key": "sourceLanguage",
        "label": "Source",
        "type": "string"
      },
      {
        "key": "targetLanguage",
        "label": "Target",
        "type": "string"
      },
      {
        "key": "characters",
        "label": "Characters",
        "type": "integer"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "translation": "가장 좋은 API로 자동 전환합니다.",
      "sourceLanguage": "en",
      "targetLanguage": "ko",
      "characters": 38
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "translation.detect",
    "label": "Language detection",
    "description": "The language of a text.",
    "params": [],
    "output": [
      {
        "key": "language",
        "label": "Language",
        "type": "string",
        "primary": true
      },
      {
        "key": "confidence",
        "label": "Confidence",
        "type": "percent",
        "unit": "%"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "language": "en",
      "confidence": 99
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "documents.parse",
    "label": "Document parsing",
    "description": "A document image to typed fields.",
    "params": [
      {
        "key": "type",
        "label": "Document type",
        "type": "enum",
        "example": "receipt",
        "values": [
          "receipt",
          "invoice",
          "id-card"
        ]
      }
    ],
    "output": [
      {
        "key": "documentType",
        "label": "Document type",
        "type": "string"
      },
      {
        "key": "fields",
        "label": "Fields",
        "type": "object",
        "primary": true
      },
      {
        "key": "pages",
        "label": "Pages",
        "type": "integer"
      },
      {
        "key": "confidence",
        "label": "Confidence",
        "type": "percent",
        "unit": "%"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "documentType": "receipt",
      "fields": {
        "merchant": "Blue Bottle Coffee",
        "total": 12.34,
        "currency": "USD",
        "date": "2026-11-09"
      },
      "pages": 1,
      "confidence": 97
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "ip.lookup",
    "label": "IP location",
    "description": "Country, city, and network type for an IP address.",
    "params": [
      {
        "key": "address",
        "label": "IP address",
        "type": "string",
        "example": "203.0.113.10"
      }
    ],
    "output": [
      {
        "key": "address",
        "label": "IP address",
        "type": "string"
      },
      {
        "key": "city",
        "label": "City",
        "type": "string",
        "primary": true
      },
      {
        "key": "countryCode",
        "label": "Country",
        "type": "string"
      },
      {
        "key": "networkType",
        "label": "Network",
        "type": "enum",
        "values": [
          "residential",
          "business",
          "hosting",
          "mobile"
        ]
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "address": "203.0.113.10",
      "city": "San Jose",
      "countryCode": "US",
      "networkType": "business"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "ip.asn",
    "label": "IP network",
    "description": "Autonomous system and organization for an IP address.",
    "params": [
      {
        "key": "address",
        "label": "IP address",
        "type": "string",
        "example": "203.0.113.10"
      }
    ],
    "output": [
      {
        "key": "address",
        "label": "IP address",
        "type": "string"
      },
      {
        "key": "asn",
        "label": "ASN",
        "type": "string",
        "primary": true
      },
      {
        "key": "organization",
        "label": "Organization",
        "type": "string"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "address": "203.0.113.10",
      "asn": "AS64500",
      "organization": "Example Networks"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "ip.risk",
    "label": "IP risk",
    "description": "Proxy, VPN, and abuse risk for an IP address.",
    "params": [
      {
        "key": "address",
        "label": "IP address",
        "type": "string",
        "example": "203.0.113.10"
      }
    ],
    "output": [
      {
        "key": "address",
        "label": "IP address",
        "type": "string"
      },
      {
        "key": "riskScore",
        "label": "Risk score",
        "type": "integer",
        "unit": "/100",
        "primary": true,
        "series": true
      },
      {
        "key": "vpn",
        "label": "VPN",
        "type": "boolean"
      },
      {
        "key": "proxy",
        "label": "Proxy",
        "type": "boolean"
      },
      {
        "key": "flags",
        "label": "Flags",
        "type": "list"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "address": "203.0.113.10",
      "riskScore": 12,
      "vpn": false,
      "proxy": false,
      "flags": []
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "email.verify",
    "label": "Email verification",
    "description": "Deliverability of an email address.",
    "params": [
      {
        "key": "address",
        "label": "Email",
        "type": "string",
        "example": "person@example.com"
      }
    ],
    "output": [
      {
        "key": "address",
        "label": "Email",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "enum",
        "primary": true,
        "values": [
          "valid",
          "invalid",
          "risky",
          "unknown"
        ]
      },
      {
        "key": "disposable",
        "label": "Disposable",
        "type": "boolean"
      },
      {
        "key": "normalized",
        "label": "Normalized",
        "type": "string"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "address": "person@example.com",
      "status": "valid",
      "disposable": false,
      "normalized": "person@example.com"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "email.risk",
    "label": "Email risk",
    "description": "Fraud risk signals for an email address.",
    "params": [
      {
        "key": "address",
        "label": "Email",
        "type": "string",
        "example": "person@example.com"
      }
    ],
    "output": [
      {
        "key": "address",
        "label": "Email",
        "type": "string"
      },
      {
        "key": "risk",
        "label": "Risk",
        "type": "enum",
        "primary": true,
        "values": [
          "low",
          "medium",
          "high"
        ]
      },
      {
        "key": "flags",
        "label": "Flags",
        "type": "list"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "address": "person@example.com",
      "risk": "low",
      "flags": []
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "phone.verify",
    "label": "Phone verification",
    "description": "Validity, country, and line type for a phone number.",
    "params": [
      {
        "key": "number",
        "label": "Phone number",
        "type": "string",
        "example": "+14155550100"
      }
    ],
    "output": [
      {
        "key": "e164",
        "label": "Number",
        "type": "string"
      },
      {
        "key": "valid",
        "label": "Valid",
        "type": "boolean",
        "primary": true
      },
      {
        "key": "countryCode",
        "label": "Country",
        "type": "string"
      },
      {
        "key": "lineType",
        "label": "Line type",
        "type": "enum",
        "values": [
          "mobile",
          "landline",
          "voip"
        ]
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "e164": "+14155550100",
      "valid": true,
      "countryCode": "US",
      "lineType": "mobile"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "screening.sanctions",
    "label": "Sanctions screening",
    "description": "A name checked against sanctions lists.",
    "params": [
      {
        "key": "name",
        "label": "Name",
        "type": "string",
        "example": "Jane Doe"
      }
    ],
    "output": [
      {
        "key": "subject",
        "label": "Subject",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Result",
        "type": "enum",
        "primary": true,
        "values": [
          "no-match",
          "possible-match",
          "match"
        ]
      },
      {
        "key": "listsChecked",
        "label": "Lists checked",
        "type": "list"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "List age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "subject": "Jane Doe",
      "status": "no-match",
      "listsChecked": [
        "OFAC SDN",
        "EU consolidated",
        "UN"
      ]
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "screening.pep",
    "label": "PEP screening",
    "description": "A name checked against politically exposed person lists.",
    "params": [
      {
        "key": "name",
        "label": "Name",
        "type": "string",
        "example": "Jane Doe"
      }
    ],
    "output": [
      {
        "key": "subject",
        "label": "Subject",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Result",
        "type": "enum",
        "primary": true,
        "values": [
          "no-match",
          "possible-match",
          "match"
        ]
      },
      {
        "key": "confidence",
        "label": "Confidence",
        "type": "percent",
        "unit": "%"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "List age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "subject": "Jane Doe",
      "status": "no-match",
      "confidence": 99
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "screening.document",
    "label": "ID document check",
    "description": "An identity document checked for format and tampering.",
    "params": [
      {
        "key": "documentId",
        "label": "Document",
        "type": "string",
        "example": "passport"
      }
    ],
    "output": [
      {
        "key": "documentId",
        "label": "Document",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Result",
        "type": "enum",
        "primary": true,
        "values": [
          "verified",
          "review",
          "rejected"
        ]
      },
      {
        "key": "checks",
        "label": "Checks",
        "type": "list"
      }
    ],
    "freshness": {
      "basis": "generated",
      "label": "Data age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "documentId": "passport",
      "status": "verified",
      "checks": [
        "format",
        "mrz",
        "expiry"
      ]
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "companies.profile",
    "label": "Company profile",
    "description": "Firmographics for a company domain.",
    "params": [
      {
        "key": "domain",
        "label": "Domain",
        "type": "string",
        "example": "stripe.com"
      }
    ],
    "output": [
      {
        "key": "name",
        "label": "Company",
        "type": "string",
        "primary": true
      },
      {
        "key": "domain",
        "label": "Domain",
        "type": "string"
      },
      {
        "key": "industry",
        "label": "Industry",
        "type": "string"
      },
      {
        "key": "employeeRange",
        "label": "Employees",
        "type": "string"
      },
      {
        "key": "country",
        "label": "Country",
        "type": "string"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "name": "Stripe",
      "domain": "stripe.com",
      "industry": "Financial software",
      "employeeRange": "5001-10000",
      "country": "US"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "companies.funding",
    "label": "Company funding",
    "description": "Latest funding round for a company domain.",
    "params": [
      {
        "key": "domain",
        "label": "Domain",
        "type": "string",
        "example": "stripe.com"
      }
    ],
    "output": [
      {
        "key": "company",
        "label": "Company",
        "type": "string"
      },
      {
        "key": "latestRound",
        "label": "Latest round",
        "type": "string",
        "primary": true
      },
      {
        "key": "announcedOn",
        "label": "Announced",
        "type": "date"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "company": "Stripe",
      "latestRound": "Series I",
      "announcedOn": "2023-03-15"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "companies.registry",
    "label": "Company registry",
    "description": "Registry status and entity type for a registered company.",
    "params": [
      {
        "key": "jurisdiction",
        "label": "Jurisdiction",
        "type": "string",
        "example": "US-DE"
      },
      {
        "key": "number",
        "label": "Registry number",
        "type": "string",
        "example": "4675506"
      }
    ],
    "output": [
      {
        "key": "jurisdiction",
        "label": "Jurisdiction",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "enum",
        "primary": true,
        "values": [
          "active",
          "inactive",
          "dissolved"
        ]
      },
      {
        "key": "entityType",
        "label": "Entity type",
        "type": "string"
      },
      {
        "key": "incorporatedOn",
        "label": "Incorporated",
        "type": "date"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Data age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "jurisdiction": "US-DE",
      "status": "active",
      "entityType": "Corporation",
      "incorporatedOn": "2009-07-29"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "web.search",
    "label": "Web search",
    "description": "A query to ranked web results.",
    "params": [
      {
        "key": "query",
        "label": "Query",
        "type": "string",
        "example": "api marketplace"
      }
    ],
    "output": [
      {
        "key": "query",
        "label": "Query",
        "type": "string"
      },
      {
        "key": "results",
        "label": "Results",
        "type": "list",
        "primary": true
      },
      {
        "key": "totalResults",
        "label": "Total results",
        "type": "integer"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Index age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "query": "api marketplace",
      "results": [
        {
          "title": "Tender: make APIs compete for your traffic",
          "url": "https://tender.heyarca.app"
        }
      ],
      "totalResults": 1240000
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "web.extract",
    "label": "Page content",
    "description": "A URL to clean page text.",
    "params": [
      {
        "key": "url",
        "label": "URL",
        "type": "string",
        "example": "https://tender.heyarca.app"
      }
    ],
    "output": [
      {
        "key": "url",
        "label": "URL",
        "type": "url"
      },
      {
        "key": "title",
        "label": "Title",
        "type": "string",
        "primary": true
      },
      {
        "key": "text",
        "label": "Text",
        "type": "string"
      },
      {
        "key": "words",
        "label": "Words",
        "type": "integer"
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Crawl age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "url": "https://tender.heyarca.app",
      "title": "Tender",
      "text": "Make APIs compete for your traffic.",
      "words": 6
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "web.metadata",
    "label": "Page metadata",
    "description": "A URL to title, description, and preview image.",
    "params": [
      {
        "key": "url",
        "label": "URL",
        "type": "string",
        "example": "https://tender.heyarca.app"
      }
    ],
    "output": [
      {
        "key": "url",
        "label": "URL",
        "type": "url"
      },
      {
        "key": "title",
        "label": "Title",
        "type": "string",
        "primary": true
      },
      {
        "key": "description",
        "label": "Description",
        "type": "string"
      },
      {
        "key": "image",
        "label": "Preview image",
        "type": "url",
        "optional": true
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Crawl age",
      "unit": "min"
    },
    "resultView": "fields",
    "sample": {
      "url": "https://tender.heyarca.app",
      "title": "Tender",
      "description": "The execution market for APIs.",
      "image": "https://tender.heyarca.app/opengraph-image.png"
    },
    "version": 1,
    "pricingUnit": "request"
  },
  {
    "id": "sports.score",
    "label": "Game score",
    "description": "Status, clock, and score for a game.",
    "params": [
      {
        "key": "league",
        "label": "League",
        "type": "string",
        "example": "NBA"
      },
      {
        "key": "game",
        "label": "Game",
        "type": "string",
        "example": "nba-2026-11-09-lal-bos"
      }
    ],
    "output": [
      {
        "key": "league",
        "label": "League",
        "type": "string"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "enum",
        "values": [
          "scheduled",
          "live",
          "final"
        ]
      },
      {
        "key": "home.name",
        "label": "Home",
        "type": "string"
      },
      {
        "key": "home.score",
        "label": "Home score",
        "type": "integer",
        "primary": true,
        "series": true
      },
      {
        "key": "away.name",
        "label": "Away",
        "type": "string"
      },
      {
        "key": "away.score",
        "label": "Away score",
        "type": "integer"
      },
      {
        "key": "clock",
        "label": "Clock",
        "type": "string",
        "optional": true
      },
      {
        "key": "startsAt",
        "label": "Starts at",
        "type": "timestamp",
        "optional": true
      }
    ],
    "freshness": {
      "basis": "source",
      "label": "Score age",
      "unit": "ms"
    },
    "resultView": "fields",
    "sample": {
      "league": "NBA",
      "status": "final",
      "home": {
        "name": "Boston",
        "score": 108
      },
      "away": {
        "name": "Los Angeles",
        "score": 104
      },
      "clock": "Final"
    },
    "version": 1,
    "pricingUnit": "request"
  }
];

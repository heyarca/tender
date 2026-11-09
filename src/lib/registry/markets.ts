// Generated from the Tender registry design (docs/DATA-MODEL.md). Edit the data here; the engine, pages, API, and SDK read it.
import type { MarketSpec } from "./types";

/** Every market, in directory order: group, then category, featured first. */
export const MARKET_SPECS: readonly MarketSpec[] = [
  {
    "id": "sf-weather",
    "categoryId": "weather",
    "contractId": "weather.current",
    "params": {
      "location": "san-francisco"
    },
    "name": "San Francisco Weather",
    "shortName": "SF Weather",
    "description": "Current conditions for San Francisco through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/Los_Angeles",
    "source": "upstream",
    "featured": true,
    "sample": {
      "location": {
        "name": "San Francisco, CA"
      },
      "temperatureF": 61,
      "humidityPct": 86,
      "windMph": 9,
      "pressureHpa": 1018,
      "visibilityMi": 9.4,
      "dewPointF": 57,
      "cloudCoverPct": 100
    },
    "listings": [
      {
        "providerId": "together",
        "bidPrice": 18,
        "p95LatencyMs": 210,
        "dataAgeMs": 360000,
        "errorRate": 0.0006,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "deepinfra",
        "bidPrice": 22,
        "p95LatencyMs": 180,
        "dataAgeMs": 120000,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "fireworks",
        "bidPrice": 27.5,
        "p95LatencyMs": 150,
        "dataAgeMs": 300000,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.1
      },
      {
        "providerId": "digitalocean",
        "bidPrice": 31,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.6
      },
      {
        "providerId": "cloudflare",
        "bidPrice": 12,
        "p95LatencyMs": 640,
        "dataAgeMs": 300000,
        "errorRate": 0.0005,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "modal",
        "bidPrice": 15,
        "p95LatencyMs": 190,
        "dataAgeMs": 2520000,
        "errorRate": 0.0008,
        "available": true,
        "bias": -0.8
      },
      {
        "providerId": "mistral",
        "bidPrice": 58,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "nebius",
        "bidPrice": 20,
        "p95LatencyMs": 230,
        "dataAgeMs": 420000,
        "errorRate": 0.002,
        "available": false,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/markets/sf-weather.jpg",
      "alt": "Golden Gate Bridge in San Francisco."
    }
  },
  {
    "id": "seoul-weather",
    "categoryId": "weather",
    "contractId": "weather.current",
    "params": {
      "location": "seoul"
    },
    "name": "Seoul Weather",
    "shortName": "Seoul Weather",
    "description": "Current conditions for Seoul through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": true,
    "sample": {
      "location": {
        "name": "Seoul, South Korea"
      },
      "temperatureF": 41,
      "humidityPct": 55,
      "windMph": 7,
      "pressureHpa": 1022,
      "visibilityMi": 9,
      "dewPointF": 27,
      "cloudCoverPct": 20
    },
    "listings": [
      {
        "providerId": "together",
        "bidPrice": 18,
        "p95LatencyMs": 210,
        "dataAgeMs": 360000,
        "errorRate": 0.0006,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "deepinfra",
        "bidPrice": 22,
        "p95LatencyMs": 180,
        "dataAgeMs": 120000,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "fireworks",
        "bidPrice": 27.5,
        "p95LatencyMs": 150,
        "dataAgeMs": 300000,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.1
      },
      {
        "providerId": "digitalocean",
        "bidPrice": 31,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.6
      },
      {
        "providerId": "cloudflare",
        "bidPrice": 12,
        "p95LatencyMs": 640,
        "dataAgeMs": 300000,
        "errorRate": 0.0005,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "modal",
        "bidPrice": 15,
        "p95LatencyMs": 190,
        "dataAgeMs": 2520000,
        "errorRate": 0.0008,
        "available": true,
        "bias": -0.8
      },
      {
        "providerId": "mistral",
        "bidPrice": 58,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "nebius",
        "bidPrice": 20,
        "p95LatencyMs": 230,
        "dataAgeMs": 420000,
        "errorRate": 0.002,
        "available": false,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/markets/seoul-weather.jpg",
      "alt": "Seoul skyline at dusk."
    }
  },
  {
    "id": "ny-weather",
    "categoryId": "weather",
    "contractId": "weather.current",
    "params": {
      "location": "new-york"
    },
    "name": "New York Weather",
    "shortName": "NY Weather",
    "description": "Current conditions for New York through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/New_York",
    "source": "signal",
    "featured": false,
    "sample": {
      "location": {
        "name": "New York, NY"
      },
      "temperatureF": 52,
      "humidityPct": 68,
      "windMph": 12,
      "pressureHpa": 1015,
      "visibilityMi": 8,
      "dewPointF": 42,
      "cloudCoverPct": 55
    },
    "listings": [
      {
        "providerId": "together",
        "bidPrice": 18,
        "p95LatencyMs": 210,
        "dataAgeMs": 360000,
        "errorRate": 0.0006,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "deepinfra",
        "bidPrice": 22,
        "p95LatencyMs": 180,
        "dataAgeMs": 120000,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "fireworks",
        "bidPrice": 27.5,
        "p95LatencyMs": 150,
        "dataAgeMs": 300000,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.1
      },
      {
        "providerId": "digitalocean",
        "bidPrice": 31,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.6
      },
      {
        "providerId": "cloudflare",
        "bidPrice": 12,
        "p95LatencyMs": 640,
        "dataAgeMs": 300000,
        "errorRate": 0.0005,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "modal",
        "bidPrice": 15,
        "p95LatencyMs": 190,
        "dataAgeMs": 2520000,
        "errorRate": 0.0008,
        "available": true,
        "bias": -0.8
      },
      {
        "providerId": "mistral",
        "bidPrice": 58,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "nebius",
        "bidPrice": 20,
        "p95LatencyMs": 230,
        "dataAgeMs": 420000,
        "errorRate": 0.002,
        "available": false,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/markets/ny-weather.jpg",
      "alt": "New York City skyline."
    }
  },
  {
    "id": "london-weather",
    "categoryId": "weather",
    "contractId": "weather.current",
    "params": {
      "location": "london"
    },
    "name": "London Weather",
    "shortName": "London Weather",
    "description": "Current conditions for London through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Europe/London",
    "source": "signal",
    "featured": false,
    "sample": {
      "location": {
        "name": "London, UK"
      },
      "temperatureF": 48,
      "humidityPct": 78,
      "windMph": 14,
      "pressureHpa": 1009,
      "visibilityMi": 6,
      "dewPointF": 42,
      "cloudCoverPct": 85
    },
    "listings": [
      {
        "providerId": "together",
        "bidPrice": 18,
        "p95LatencyMs": 210,
        "dataAgeMs": 360000,
        "errorRate": 0.0006,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "deepinfra",
        "bidPrice": 22,
        "p95LatencyMs": 180,
        "dataAgeMs": 120000,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "fireworks",
        "bidPrice": 27.5,
        "p95LatencyMs": 150,
        "dataAgeMs": 300000,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.1
      },
      {
        "providerId": "digitalocean",
        "bidPrice": 31,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.6
      },
      {
        "providerId": "cloudflare",
        "bidPrice": 12,
        "p95LatencyMs": 640,
        "dataAgeMs": 300000,
        "errorRate": 0.0005,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "modal",
        "bidPrice": 15,
        "p95LatencyMs": 190,
        "dataAgeMs": 2520000,
        "errorRate": 0.0008,
        "available": true,
        "bias": -0.8
      },
      {
        "providerId": "mistral",
        "bidPrice": 58,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "nebius",
        "bidPrice": 20,
        "p95LatencyMs": 230,
        "dataAgeMs": 420000,
        "errorRate": 0.002,
        "available": false,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/markets/london-weather.jpg",
      "alt": "Big Ben and the Houses of Parliament in London."
    }
  },
  {
    "id": "tokyo-weather",
    "categoryId": "weather",
    "contractId": "weather.current",
    "params": {
      "location": "tokyo"
    },
    "name": "Tokyo Weather",
    "shortName": "Tokyo Weather",
    "description": "Current conditions for Tokyo through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Tokyo",
    "source": "signal",
    "featured": false,
    "sample": {
      "location": {
        "name": "Tokyo, Japan"
      },
      "temperatureF": 57,
      "humidityPct": 60,
      "windMph": 9,
      "pressureHpa": 1016,
      "visibilityMi": 11,
      "dewPointF": 44,
      "cloudCoverPct": 35
    },
    "listings": [
      {
        "providerId": "together",
        "bidPrice": 18,
        "p95LatencyMs": 210,
        "dataAgeMs": 360000,
        "errorRate": 0.0006,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "deepinfra",
        "bidPrice": 22,
        "p95LatencyMs": 180,
        "dataAgeMs": 120000,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "fireworks",
        "bidPrice": 27.5,
        "p95LatencyMs": 150,
        "dataAgeMs": 300000,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.1
      },
      {
        "providerId": "digitalocean",
        "bidPrice": 31,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.6
      },
      {
        "providerId": "cloudflare",
        "bidPrice": 12,
        "p95LatencyMs": 640,
        "dataAgeMs": 300000,
        "errorRate": 0.0005,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "modal",
        "bidPrice": 15,
        "p95LatencyMs": 190,
        "dataAgeMs": 2520000,
        "errorRate": 0.0008,
        "available": true,
        "bias": -0.8
      },
      {
        "providerId": "mistral",
        "bidPrice": 58,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "nebius",
        "bidPrice": 20,
        "p95LatencyMs": 230,
        "dataAgeMs": 420000,
        "errorRate": 0.002,
        "available": false,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/markets/tokyo-weather.jpg",
      "alt": "Tokyo Tower."
    }
  },
  {
    "id": "singapore-weather",
    "categoryId": "weather",
    "contractId": "weather.current",
    "params": {
      "location": "singapore"
    },
    "name": "Singapore Weather",
    "shortName": "Singapore Weather",
    "description": "Current conditions for Singapore through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Singapore",
    "source": "signal",
    "featured": false,
    "sample": {
      "location": {
        "name": "Singapore"
      },
      "temperatureF": 86,
      "humidityPct": 82,
      "windMph": 6,
      "pressureHpa": 1010,
      "visibilityMi": 6,
      "dewPointF": 78,
      "cloudCoverPct": 70
    },
    "listings": [
      {
        "providerId": "together",
        "bidPrice": 18,
        "p95LatencyMs": 210,
        "dataAgeMs": 360000,
        "errorRate": 0.0006,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "deepinfra",
        "bidPrice": 22,
        "p95LatencyMs": 180,
        "dataAgeMs": 120000,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "fireworks",
        "bidPrice": 27.5,
        "p95LatencyMs": 150,
        "dataAgeMs": 300000,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.1
      },
      {
        "providerId": "digitalocean",
        "bidPrice": 31,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.6
      },
      {
        "providerId": "cloudflare",
        "bidPrice": 12,
        "p95LatencyMs": 640,
        "dataAgeMs": 300000,
        "errorRate": 0.0005,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "modal",
        "bidPrice": 15,
        "p95LatencyMs": 190,
        "dataAgeMs": 2520000,
        "errorRate": 0.0008,
        "available": true,
        "bias": -0.8
      },
      {
        "providerId": "mistral",
        "bidPrice": 58,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "nebius",
        "bidPrice": 20,
        "p95LatencyMs": 230,
        "dataAgeMs": 420000,
        "errorRate": 0.002,
        "available": false,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/markets/singapore-weather.jpg",
      "alt": "Marina Bay Sands in Singapore."
    }
  },
  {
    "id": "seoul-air",
    "categoryId": "air-quality",
    "contractId": "airQuality.current",
    "params": {
      "location": "seoul"
    },
    "name": "Seoul Air Quality",
    "shortName": "Seoul AQI",
    "description": "Seoul Air Quality through one normalized airQuality.current contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": true,
    "sample": {
      "location": "Seoul",
      "aqi": 61,
      "category": "moderate",
      "dominantPollutant": "pm25",
      "pm25": 18.4,
      "pm10": 31.0,
      "ozone": 0.031
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 6.04,
        "p95LatencyMs": 46,
        "dataAgeMs": 17413,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 7.14,
        "p95LatencyMs": 87,
        "dataAgeMs": 21614,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/air-quality.jpg",
      "avif": "/catalog/air-quality.avif",
      "alt": "Fog drifting through a dense green forest."
    }
  },
  {
    "id": "london-air",
    "categoryId": "air-quality",
    "contractId": "airQuality.current",
    "params": {
      "location": "london"
    },
    "name": "London Air Quality",
    "shortName": "London AQI",
    "description": "London Air Quality through one normalized airQuality.current contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Europe/London",
    "source": "signal",
    "featured": false,
    "sample": {
      "location": "London",
      "aqi": 34,
      "category": "good",
      "dominantPollutant": "no2",
      "pm25": 8.1,
      "pm10": 14.2,
      "ozone": 0.024
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 7.74,
        "p95LatencyMs": 75,
        "dataAgeMs": 19320,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 8.84,
        "p95LatencyMs": 116,
        "dataAgeMs": 23521,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/air-quality.jpg",
      "avif": "/catalog/air-quality.avif",
      "alt": "Fog drifting through a dense green forest."
    }
  },
  {
    "id": "la-air",
    "categoryId": "air-quality",
    "contractId": "airQuality.current",
    "params": {
      "location": "los-angeles"
    },
    "name": "Los Angeles Air Quality",
    "shortName": "LA AQI",
    "description": "Los Angeles Air Quality through one normalized airQuality.current contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/Los_Angeles",
    "source": "signal",
    "featured": false,
    "sample": {
      "location": "Los Angeles",
      "aqi": 72,
      "category": "moderate",
      "dominantPollutant": "ozone",
      "pm25": 12.6,
      "pm10": 24.0,
      "ozone": 0.061
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 9.44,
        "p95LatencyMs": 104,
        "dataAgeMs": 21227,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.04,
        "p95LatencyMs": 145,
        "dataAgeMs": 25428,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/air-quality.jpg",
      "avif": "/catalog/air-quality.avif",
      "alt": "Fog drifting through a dense green forest."
    }
  },
  {
    "id": "sz-mlcc",
    "categoryId": "component-prices",
    "contractId": "components.price",
    "params": {
      "part": "MLCC-0402-100NF",
      "market": "huaqiangbei"
    },
    "name": "Shenzhen MLCC Spot Price",
    "shortName": "SZ MLCC",
    "description": "Huaqiangbei spot price for 0402 100nF MLCC reels, with stock and lead time, through one normalized contract. Component brokers bid to serve each quote; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Shanghai",
    "source": "signal",
    "featured": true,
    "sample": {
      "part": "MLCC-0402-100NF",
      "price": 3.42
    },
    "listings": [
      {
        "providerId": "arca-labs",
        "bidPrice": 21,
        "p95LatencyMs": 240,
        "dataAgeMs": 360000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "huaqiang-desk",
        "bidPrice": 32,
        "p95LatencyMs": 420,
        "dataAgeMs": 1200000,
        "errorRate": 0.004,
        "available": true,
        "bias": 0.2
      },
      {
        "providerId": "futian-parts",
        "bidPrice": 45,
        "p95LatencyMs": 260,
        "dataAgeMs": 480000,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "pearl-river",
        "bidPrice": 24,
        "p95LatencyMs": 950,
        "dataAgeMs": 2100000,
        "errorRate": 0.006,
        "available": true,
        "bias": 0.5
      },
      {
        "providerId": "seg-broker",
        "bidPrice": 58,
        "p95LatencyMs": 180,
        "dataAgeMs": 240000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.1
      },
      {
        "providerId": "bom-scout",
        "bidPrice": 18,
        "p95LatencyMs": 640,
        "dataAgeMs": 5700000,
        "errorRate": 0.012,
        "available": true,
        "bias": 0.8
      }
    ],
    "image": {
      "src": "/catalog/sz-mlcc.jpg",
      "avif": "/catalog/sz-mlcc.avif",
      "alt": "Close-up of ceramic capacitors on a circuit board."
    }
  },
  {
    "id": "lithium-carbonate",
    "categoryId": "commodities",
    "contractId": "commodities.spot",
    "params": {
      "symbol": "LI2CO3-CN"
    },
    "name": "Lithium Carbonate Spot",
    "shortName": "Li₂CO₃",
    "description": "Battery-grade lithium carbonate spot price through one normalized contract. Commodity data desks bid to serve each quote; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Shanghai",
    "source": "signal",
    "sample": {
      "symbol": "LI2CO3-CN",
      "price": 10480,
      "unit": "tonne",
      "benchmark": "Battery grade 99.5%"
    },
    "listings": [
      {
        "providerId": "salar-index",
        "bidPrice": 42,
        "p95LatencyMs": 310,
        "dataAgeMs": 720000,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 48,
        "p95LatencyMs": 150,
        "dataAgeMs": 240000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "cathode-wire",
        "bidPrice": 66,
        "p95LatencyMs": 140,
        "dataAgeMs": 180000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "yichun-desk",
        "bidPrice": 28,
        "p95LatencyMs": 520,
        "dataAgeMs": 1500000,
        "errorRate": 0.004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "metal-ledger",
        "bidPrice": 90,
        "p95LatencyMs": 95,
        "dataAgeMs": 60000,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/catalog/lithium-carbonate.jpg",
      "avif": "/catalog/lithium-carbonate.avif",
      "alt": "Polished pale stone with crystalline veins."
    }
  },
  {
    "id": "gold-usd",
    "categoryId": "commodities",
    "contractId": "commodities.spot",
    "params": {
      "symbol": "XAU-USD"
    },
    "name": "Gold Spot",
    "shortName": "XAU/USD",
    "description": "Gold Spot through one normalized commodities.spot contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "symbol": "XAU-USD",
      "price": 2634.6,
      "unit": "troy oz",
      "benchmark": "Spot"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.34,
        "p95LatencyMs": 132,
        "dataAgeMs": 5971,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.44,
        "p95LatencyMs": 173,
        "dataAgeMs": 10172,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/commodities.jpg",
      "avif": "/catalog/commodities.avif",
      "alt": "Textured metallic gold leaf surface."
    }
  },
  {
    "id": "wti-usd",
    "categoryId": "commodities",
    "contractId": "commodities.spot",
    "params": {
      "symbol": "WTI-USD"
    },
    "name": "WTI Crude Oil",
    "shortName": "WTI",
    "description": "WTI Crude Oil through one normalized commodities.spot contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "symbol": "WTI-USD",
      "price": 71.42,
      "unit": "barrel",
      "benchmark": "NYMEX front month"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 7.04,
        "p95LatencyMs": 161,
        "dataAgeMs": 7878,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 8.14,
        "p95LatencyMs": 202,
        "dataAgeMs": 12079,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/commodities.jpg",
      "avif": "/catalog/commodities.avif",
      "alt": "Textured metallic gold leaf surface."
    }
  },
  {
    "id": "wheat-usd",
    "categoryId": "commodities",
    "contractId": "commodities.spot",
    "params": {
      "symbol": "WHEAT"
    },
    "name": "Wheat Futures",
    "shortName": "Wheat",
    "description": "Wheat Futures through one normalized commodities.spot contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "symbol": "WHEAT",
      "price": 5.82,
      "unit": "bushel",
      "benchmark": "CBOT front month"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 8.74,
        "p95LatencyMs": 190,
        "dataAgeMs": 9785,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.34,
        "p95LatencyMs": 231,
        "dataAgeMs": 13986,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/commodities.jpg",
      "avif": "/catalog/commodities.avif",
      "alt": "Textured metallic gold leaf surface."
    }
  },
  {
    "id": "aapl-usd",
    "categoryId": "stock-quotes",
    "contractId": "stocks.quote",
    "params": {
      "symbol": "AAPL"
    },
    "name": "Apple Stock Quote",
    "shortName": "AAPL",
    "description": "Apple Stock Quote through one normalized stocks.quote contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/New_York",
    "source": "signal",
    "featured": true,
    "sample": {
      "symbol": "AAPL",
      "last": 228.42,
      "bid": 228.4,
      "ask": 228.44,
      "volume": 41250000,
      "exchange": "NASDAQ"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.24,
        "p95LatencyMs": 45,
        "dataAgeMs": 250,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.34,
        "p95LatencyMs": 86,
        "dataAgeMs": 4451,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/stock-quotes.jpg",
      "avif": "/catalog/stock-quotes.avif",
      "alt": "Abstract candlestick lights on a dark financial display."
    }
  },
  {
    "id": "msft-usd",
    "categoryId": "stock-quotes",
    "contractId": "stocks.quote",
    "params": {
      "symbol": "MSFT"
    },
    "name": "Microsoft Stock Quote",
    "shortName": "MSFT",
    "description": "Microsoft Stock Quote through one normalized stocks.quote contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/New_York",
    "source": "signal",
    "featured": false,
    "sample": {
      "symbol": "MSFT",
      "last": 418.16,
      "bid": 418.12,
      "ask": 418.2,
      "volume": 19870000,
      "exchange": "NASDAQ"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 1.94,
        "p95LatencyMs": 74,
        "dataAgeMs": 2157,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.04,
        "p95LatencyMs": 115,
        "dataAgeMs": 6358,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/stock-quotes.jpg",
      "avif": "/catalog/stock-quotes.avif",
      "alt": "Abstract candlestick lights on a dark financial display."
    }
  },
  {
    "id": "nvda-usd",
    "categoryId": "stock-quotes",
    "contractId": "stocks.quote",
    "params": {
      "symbol": "NVDA"
    },
    "name": "NVIDIA Stock Quote",
    "shortName": "NVDA",
    "description": "NVIDIA Stock Quote through one normalized stocks.quote contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/New_York",
    "source": "signal",
    "featured": false,
    "sample": {
      "symbol": "NVDA",
      "last": 148.88,
      "bid": 148.86,
      "ask": 148.9,
      "volume": 212400000,
      "exchange": "NASDAQ"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.64,
        "p95LatencyMs": 103,
        "dataAgeMs": 4064,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.74,
        "p95LatencyMs": 144,
        "dataAgeMs": 8265,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/stock-quotes.jpg",
      "avif": "/catalog/stock-quotes.avif",
      "alt": "Abstract candlestick lights on a dark financial display."
    }
  },
  {
    "id": "eur-usd",
    "categoryId": "currencies",
    "contractId": "prices.spot",
    "params": {
      "pair": "EUR-USD"
    },
    "name": "Euro Rate",
    "shortName": "EUR/USD",
    "icon": "euro",
    "description": "EUR/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like.",
    "timeZone": "UTC",
    "source": "signal",
    "sample": {
      "pair": "EUR-USD",
      "priceUsd": 1.0812
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.7,
        "p95LatencyMs": 87,
        "dataAgeMs": 220,
        "errorRate": 0.0003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.95,
        "p95LatencyMs": 64,
        "dataAgeMs": 140,
        "errorRate": 0.0002,
        "available": true,
        "bias": -0.4
      },
      {
        "providerId": "coreweave",
        "bidPrice": 1.4,
        "p95LatencyMs": 42,
        "dataAgeMs": 90,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.15
      },
      {
        "providerId": "baseten",
        "bidPrice": 1.8,
        "p95LatencyMs": 58,
        "dataAgeMs": 45,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "novita",
        "bidPrice": 0.4,
        "p95LatencyMs": 310,
        "dataAgeMs": 180,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "crusoe",
        "bidPrice": 0.55,
        "p95LatencyMs": 72,
        "dataAgeMs": 2400,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.7
      },
      {
        "providerId": "gmicloud",
        "bidPrice": 2.6,
        "p95LatencyMs": 38,
        "dataAgeMs": 60,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.05
      },
      {
        "providerId": "wafer",
        "bidPrice": 0.6,
        "p95LatencyMs": 95,
        "dataAgeMs": 300,
        "errorRate": 0.0085,
        "available": true,
        "bias": 0.9
      }
    ],
    "image": {
      "src": "/markets/eur-usd.jpg",
      "alt": "Euro banknotes."
    }
  },
  {
    "id": "gbp-usd",
    "categoryId": "currencies",
    "contractId": "prices.spot",
    "params": {
      "pair": "GBP-USD"
    },
    "name": "Pound Sterling Rate",
    "shortName": "GBP/USD",
    "icon": "pound",
    "description": "GBP/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like.",
    "timeZone": "UTC",
    "source": "signal",
    "sample": {
      "pair": "GBP-USD",
      "priceUsd": 1.2734
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.7,
        "p95LatencyMs": 87,
        "dataAgeMs": 220,
        "errorRate": 0.0003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.95,
        "p95LatencyMs": 64,
        "dataAgeMs": 140,
        "errorRate": 0.0002,
        "available": true,
        "bias": -0.4
      },
      {
        "providerId": "coreweave",
        "bidPrice": 1.4,
        "p95LatencyMs": 42,
        "dataAgeMs": 90,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.15
      },
      {
        "providerId": "baseten",
        "bidPrice": 1.8,
        "p95LatencyMs": 58,
        "dataAgeMs": 45,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "novita",
        "bidPrice": 0.4,
        "p95LatencyMs": 310,
        "dataAgeMs": 180,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "crusoe",
        "bidPrice": 0.55,
        "p95LatencyMs": 72,
        "dataAgeMs": 2400,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.7
      },
      {
        "providerId": "gmicloud",
        "bidPrice": 2.6,
        "p95LatencyMs": 38,
        "dataAgeMs": 60,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.05
      },
      {
        "providerId": "wafer",
        "bidPrice": 0.6,
        "p95LatencyMs": 95,
        "dataAgeMs": 300,
        "errorRate": 0.0085,
        "available": true,
        "bias": 0.9
      }
    ],
    "image": {
      "src": "/markets/gbp-usd.jpg",
      "alt": "Pound sterling banknotes."
    }
  },
  {
    "id": "btc-usd",
    "categoryId": "crypto-prices",
    "contractId": "prices.spot",
    "params": {
      "pair": "BTC-USD"
    },
    "name": "Bitcoin Price",
    "shortName": "BTC/USD",
    "icon": "bitcoin",
    "description": "BTC/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like.",
    "timeZone": "UTC",
    "source": "upstream",
    "sample": {
      "pair": "BTC-USD",
      "priceUsd": 75230.75
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.7,
        "p95LatencyMs": 87,
        "dataAgeMs": 220,
        "errorRate": 0.0003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.95,
        "p95LatencyMs": 64,
        "dataAgeMs": 140,
        "errorRate": 0.0002,
        "available": true,
        "bias": -0.4
      },
      {
        "providerId": "coreweave",
        "bidPrice": 1.4,
        "p95LatencyMs": 42,
        "dataAgeMs": 90,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.15
      },
      {
        "providerId": "baseten",
        "bidPrice": 1.8,
        "p95LatencyMs": 58,
        "dataAgeMs": 45,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "novita",
        "bidPrice": 0.4,
        "p95LatencyMs": 310,
        "dataAgeMs": 180,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "crusoe",
        "bidPrice": 0.55,
        "p95LatencyMs": 72,
        "dataAgeMs": 2400,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.7
      },
      {
        "providerId": "gmicloud",
        "bidPrice": 2.6,
        "p95LatencyMs": 38,
        "dataAgeMs": 60,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.05
      },
      {
        "providerId": "wafer",
        "bidPrice": 0.6,
        "p95LatencyMs": 95,
        "dataAgeMs": 300,
        "errorRate": 0.0085,
        "available": true,
        "bias": 0.9
      }
    ],
    "image": {
      "src": "/markets/btc-usd.jpg",
      "alt": "A bitcoin coin."
    }
  },
  {
    "id": "eth-usd",
    "categoryId": "crypto-prices",
    "contractId": "prices.spot",
    "params": {
      "pair": "ETH-USD"
    },
    "name": "Ethereum Price",
    "shortName": "ETH/USD",
    "icon": "coins",
    "description": "ETH/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like.",
    "timeZone": "UTC",
    "source": "signal",
    "sample": {
      "pair": "ETH-USD",
      "priceUsd": 3180.4
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.7,
        "p95LatencyMs": 87,
        "dataAgeMs": 220,
        "errorRate": 0.0003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.95,
        "p95LatencyMs": 64,
        "dataAgeMs": 140,
        "errorRate": 0.0002,
        "available": true,
        "bias": -0.4
      },
      {
        "providerId": "coreweave",
        "bidPrice": 1.4,
        "p95LatencyMs": 42,
        "dataAgeMs": 90,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.15
      },
      {
        "providerId": "baseten",
        "bidPrice": 1.8,
        "p95LatencyMs": 58,
        "dataAgeMs": 45,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "novita",
        "bidPrice": 0.4,
        "p95LatencyMs": 310,
        "dataAgeMs": 180,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "crusoe",
        "bidPrice": 0.55,
        "p95LatencyMs": 72,
        "dataAgeMs": 2400,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.7
      },
      {
        "providerId": "gmicloud",
        "bidPrice": 2.6,
        "p95LatencyMs": 38,
        "dataAgeMs": 60,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.05
      },
      {
        "providerId": "wafer",
        "bidPrice": 0.6,
        "p95LatencyMs": 95,
        "dataAgeMs": 300,
        "errorRate": 0.0085,
        "available": true,
        "bias": 0.9
      }
    ],
    "image": {
      "src": "/markets/eth-usd.jpg",
      "alt": "Ethereum coins."
    }
  },
  {
    "id": "sol-usd",
    "categoryId": "crypto-prices",
    "contractId": "prices.spot",
    "params": {
      "pair": "SOL-USD"
    },
    "name": "Solana Price",
    "shortName": "SOL/USD",
    "icon": "coins",
    "description": "SOL/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like.",
    "timeZone": "UTC",
    "source": "signal",
    "sample": {
      "pair": "SOL-USD",
      "priceUsd": 148.25
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.7,
        "p95LatencyMs": 87,
        "dataAgeMs": 220,
        "errorRate": 0.0003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.95,
        "p95LatencyMs": 64,
        "dataAgeMs": 140,
        "errorRate": 0.0002,
        "available": true,
        "bias": -0.4
      },
      {
        "providerId": "coreweave",
        "bidPrice": 1.4,
        "p95LatencyMs": 42,
        "dataAgeMs": 90,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.15
      },
      {
        "providerId": "baseten",
        "bidPrice": 1.8,
        "p95LatencyMs": 58,
        "dataAgeMs": 45,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "novita",
        "bidPrice": 0.4,
        "p95LatencyMs": 310,
        "dataAgeMs": 180,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "crusoe",
        "bidPrice": 0.55,
        "p95LatencyMs": 72,
        "dataAgeMs": 2400,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.7
      },
      {
        "providerId": "gmicloud",
        "bidPrice": 2.6,
        "p95LatencyMs": 38,
        "dataAgeMs": 60,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.05
      },
      {
        "providerId": "wafer",
        "bidPrice": 0.6,
        "p95LatencyMs": 95,
        "dataAgeMs": 300,
        "errorRate": 0.0085,
        "available": true,
        "bias": 0.9
      }
    ],
    "image": {
      "src": "/markets/sol-usd.jpg",
      "alt": "Crypto coins."
    }
  },
  {
    "id": "xrp-usd",
    "categoryId": "crypto-prices",
    "contractId": "prices.spot",
    "params": {
      "pair": "XRP-USD"
    },
    "name": "XRP Price",
    "shortName": "XRP/USD",
    "icon": "coins",
    "description": "XRP/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like.",
    "timeZone": "UTC",
    "source": "signal",
    "sample": {
      "pair": "XRP-USD",
      "priceUsd": 2.14
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.7,
        "p95LatencyMs": 87,
        "dataAgeMs": 220,
        "errorRate": 0.0003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.95,
        "p95LatencyMs": 64,
        "dataAgeMs": 140,
        "errorRate": 0.0002,
        "available": true,
        "bias": -0.4
      },
      {
        "providerId": "coreweave",
        "bidPrice": 1.4,
        "p95LatencyMs": 42,
        "dataAgeMs": 90,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.15
      },
      {
        "providerId": "baseten",
        "bidPrice": 1.8,
        "p95LatencyMs": 58,
        "dataAgeMs": 45,
        "errorRate": 0.0005,
        "available": true,
        "bias": -0.2
      },
      {
        "providerId": "novita",
        "bidPrice": 0.4,
        "p95LatencyMs": 310,
        "dataAgeMs": 180,
        "errorRate": 0.0004,
        "available": true,
        "bias": 0.6
      },
      {
        "providerId": "crusoe",
        "bidPrice": 0.55,
        "p95LatencyMs": 72,
        "dataAgeMs": 2400,
        "errorRate": 0.0003,
        "available": true,
        "bias": -0.7
      },
      {
        "providerId": "gmicloud",
        "bidPrice": 2.6,
        "p95LatencyMs": 38,
        "dataAgeMs": 60,
        "errorRate": 0.0001,
        "available": true,
        "bias": 0.05
      },
      {
        "providerId": "wafer",
        "bidPrice": 0.6,
        "p95LatencyMs": 95,
        "dataAgeMs": 300,
        "errorRate": 0.0085,
        "available": true,
        "bias": 0.9
      }
    ],
    "image": {
      "src": "/markets/xrp-usd.jpg",
      "alt": "Crypto coins."
    }
  },
  {
    "id": "ua1-status",
    "categoryId": "flight-status",
    "contractId": "flights.status",
    "params": {
      "flight": "UA1"
    },
    "name": "United 1 Flight Status",
    "shortName": "UA1",
    "description": "United 1 Flight Status through one normalized flights.status contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/Los_Angeles",
    "source": "signal",
    "featured": false,
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
      "delayMinutes": 0
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.94,
        "p95LatencyMs": 219,
        "dataAgeMs": 11692,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 2.04,
        "p95LatencyMs": 260,
        "dataAgeMs": 15893,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/flight-status.jpg",
      "avif": "/catalog/flight-status.avif",
      "alt": "Empty airport runway stretching toward distant buildings."
    }
  },
  {
    "id": "dl405-status",
    "categoryId": "flight-status",
    "contractId": "flights.status",
    "params": {
      "flight": "DL405"
    },
    "name": "Delta 405 Flight Status",
    "shortName": "DL405",
    "description": "Delta 405 Flight Status through one normalized flights.status contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/New_York",
    "source": "signal",
    "featured": false,
    "sample": {
      "flight": "DL405",
      "status": "en-route",
      "departure": {
        "airport": "LAX",
        "scheduled": "2026-11-09T15:00:00Z"
      },
      "arrival": {
        "airport": "JFK",
        "estimated": "2026-11-09T20:17:00Z"
      },
      "gate": "B24",
      "delayMinutes": 12
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 2.64,
        "p95LatencyMs": 248,
        "dataAgeMs": 13599,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.74,
        "p95LatencyMs": 289,
        "dataAgeMs": 17800,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/flight-status.jpg",
      "avif": "/catalog/flight-status.avif",
      "alt": "Empty airport runway stretching toward distant buildings."
    }
  },
  {
    "id": "ba178-status",
    "categoryId": "flight-status",
    "contractId": "flights.status",
    "params": {
      "flight": "BA178"
    },
    "name": "British Airways 178 Flight Status",
    "shortName": "BA178",
    "description": "British Airways 178 Flight Status through one normalized flights.status contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Europe/London",
    "source": "signal",
    "featured": false,
    "sample": {
      "flight": "BA178",
      "status": "landed",
      "departure": {
        "airport": "JFK",
        "scheduled": "2026-11-09T01:00:00Z"
      },
      "arrival": {
        "airport": "LHR",
        "estimated": "2026-11-09T13:18:00Z"
      },
      "gate": "C64",
      "delayMinutes": 0
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 4.34,
        "p95LatencyMs": 277,
        "dataAgeMs": 15506,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 5.44,
        "p95LatencyMs": 58,
        "dataAgeMs": 19707,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/flight-status.jpg",
      "avif": "/catalog/flight-status.avif",
      "alt": "Empty airport runway stretching toward distant buildings."
    }
  },
  {
    "id": "freight-sha-lax",
    "categoryId": "freight-rates",
    "contractId": "freight.rate",
    "params": {
      "origin": "CNSHA",
      "destination": "USLAX",
      "container": "40ft"
    },
    "name": "Container Freight Shanghai → LA",
    "shortName": "SHA → LAX",
    "description": "Spot rate for a 40ft container from Shanghai to Los Angeles through one normalized contract. Freight data providers bid to serve each quote; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Shanghai",
    "source": "signal",
    "sample": {
      "rateUsd": 2315
    },
    "listings": [
      {
        "providerId": "harbor-quote",
        "bidPrice": 22,
        "p95LatencyMs": 480,
        "dataAgeMs": 2700000,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.4
      },
      {
        "providerId": "lane-signal",
        "bidPrice": 35,
        "p95LatencyMs": 220,
        "dataAgeMs": 900000,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.3
      },
      {
        "providerId": "box-index",
        "bidPrice": 14,
        "p95LatencyMs": 1100,
        "dataAgeMs": 10800000,
        "errorRate": 0.008,
        "available": true,
        "bias": 0.7
      },
      {
        "providerId": "pacific-lanes",
        "bidPrice": 48,
        "p95LatencyMs": 160,
        "dataAgeMs": 360000,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.1
      }
    ],
    "image": {
      "src": "/catalog/freight-sha-lax.jpg",
      "avif": "/catalog/freight-sha-lax.avif",
      "alt": "Aerial view of shipping containers at a cargo port."
    }
  },
  {
    "id": "ups-tracking",
    "categoryId": "parcel-tracking",
    "contractId": "tracking.lookup",
    "params": {
      "carrier": "ups",
      "number": "1Z999AA10123456784"
    },
    "name": "UPS Parcel Tracking",
    "shortName": "UPS",
    "description": "UPS Parcel Tracking through one normalized tracking.lookup contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "carrier": "UPS",
      "trackingNumber": "1Z999AA10123456784",
      "status": "in-transit",
      "latestEvent": "Departed facility",
      "location": "Louisville, KY",
      "eta": "2026-11-12"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 6.74,
        "p95LatencyMs": 220,
        "dataAgeMs": 28855,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 7.84,
        "p95LatencyMs": 261,
        "dataAgeMs": 33056,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/parcel-tracking.jpg",
      "avif": "/catalog/parcel-tracking.avif",
      "alt": "Clean yellow and white storage containers."
    }
  },
  {
    "id": "fedex-tracking",
    "categoryId": "parcel-tracking",
    "contractId": "tracking.lookup",
    "params": {
      "carrier": "fedex",
      "number": "794644790138"
    },
    "name": "FedEx Parcel Tracking",
    "shortName": "FedEx",
    "description": "FedEx Parcel Tracking through one normalized tracking.lookup contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "carrier": "FedEx",
      "trackingNumber": "794644790138",
      "status": "out-for-delivery",
      "latestEvent": "On FedEx vehicle for delivery",
      "location": "Brooklyn, NY",
      "eta": "2026-11-09"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 8.44,
        "p95LatencyMs": 249,
        "dataAgeMs": 30762,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 9.54,
        "p95LatencyMs": 290,
        "dataAgeMs": 34963,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/parcel-tracking.jpg",
      "avif": "/catalog/parcel-tracking.avif",
      "alt": "Clean yellow and white storage containers."
    }
  },
  {
    "id": "dhl-tracking",
    "categoryId": "parcel-tracking",
    "contractId": "tracking.lookup",
    "params": {
      "carrier": "dhl",
      "number": "1234567890"
    },
    "name": "DHL Parcel Tracking",
    "shortName": "DHL",
    "description": "DHL Parcel Tracking through one normalized tracking.lookup contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "carrier": "DHL",
      "trackingNumber": "1234567890",
      "status": "delivered",
      "latestEvent": "Delivered, signed by recipient",
      "location": "Berlin, DE",
      "eta": "2026-11-08"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.64,
        "p95LatencyMs": 278,
        "dataAgeMs": 32669,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.74,
        "p95LatencyMs": 59,
        "dataAgeMs": 36870,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/parcel-tracking.jpg",
      "avif": "/catalog/parcel-tracking.avif",
      "alt": "Clean yellow and white storage containers."
    }
  },
  {
    "id": "sf-commute",
    "categoryId": "traffic",
    "contractId": "routes.estimate",
    "params": {
      "from": "sf-ferry-building",
      "to": "sf-caltrain"
    },
    "name": "San Francisco Commute",
    "shortName": "SF commute",
    "description": "San Francisco Commute through one normalized routes.estimate contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/Los_Angeles",
    "source": "signal",
    "featured": false,
    "sample": {
      "from": "Ferry Building",
      "to": "4th & King Caltrain",
      "durationMinutes": 14,
      "distanceKm": 3.4,
      "traffic": "moderate"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 2.34,
        "p95LatencyMs": 47,
        "dataAgeMs": 34576,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.44,
        "p95LatencyMs": 88,
        "dataAgeMs": 38777,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/traffic-eta.jpg",
      "avif": "/catalog/traffic-eta.avif",
      "alt": "Aerial view of a busy city intersection."
    }
  },
  {
    "id": "seoul-commute",
    "categoryId": "traffic",
    "contractId": "routes.estimate",
    "params": {
      "from": "gangnam-station",
      "to": "seoul-station"
    },
    "name": "Seoul Commute",
    "shortName": "Seoul commute",
    "description": "Seoul Commute through one normalized routes.estimate contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": false,
    "sample": {
      "from": "Gangnam Station",
      "to": "Seoul Station",
      "durationMinutes": 38,
      "distanceKm": 11.2,
      "traffic": "heavy"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 4.04,
        "p95LatencyMs": 76,
        "dataAgeMs": 36483,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 5.14,
        "p95LatencyMs": 117,
        "dataAgeMs": 40684,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/traffic-eta.jpg",
      "avif": "/catalog/traffic-eta.avif",
      "alt": "Aerial view of a busy city intersection."
    }
  },
  {
    "id": "london-commute",
    "categoryId": "traffic",
    "contractId": "routes.estimate",
    "params": {
      "from": "kings-cross",
      "to": "canary-wharf"
    },
    "name": "London Commute",
    "shortName": "London commute",
    "description": "London Commute through one normalized routes.estimate contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Europe/London",
    "source": "signal",
    "featured": false,
    "sample": {
      "from": "King's Cross",
      "to": "Canary Wharf",
      "durationMinutes": 29,
      "distanceKm": 6.8,
      "traffic": "light"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.74,
        "p95LatencyMs": 105,
        "dataAgeMs": 38390,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.84,
        "p95LatencyMs": 146,
        "dataAgeMs": 42591,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/traffic-eta.jpg",
      "avif": "/catalog/traffic-eta.avif",
      "alt": "Aerial view of a busy city intersection."
    }
  },
  {
    "id": "address-geocode",
    "categoryId": "geocoding",
    "contractId": "geocoding.search",
    "params": {
      "query": "1600 Amphitheatre Parkway"
    },
    "name": "Address Geocoding",
    "shortName": "Address",
    "description": "Address Geocoding through one normalized geocoding.search contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 7.44,
        "p95LatencyMs": 134,
        "dataAgeMs": 40297,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 8.54,
        "p95LatencyMs": 175,
        "dataAgeMs": 44498,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/geocoding.jpg",
      "avif": "/catalog/geocoding.avif",
      "alt": "Aerial landscape with winding roads."
    }
  },
  {
    "id": "place-geocode",
    "categoryId": "geocoding",
    "contractId": "geocoding.search",
    "params": {
      "query": "Seoul City Hall"
    },
    "name": "Place Geocoding",
    "shortName": "Place",
    "description": "Place Geocoding through one normalized geocoding.search contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "label": "Seoul City Hall, Jung-gu, Seoul",
      "latitude": 37.5663,
      "longitude": 126.9779,
      "countryCode": "KR",
      "confidence": 96
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 9.14,
        "p95LatencyMs": 163,
        "dataAgeMs": 42204,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.74,
        "p95LatencyMs": 204,
        "dataAgeMs": 46405,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/geocoding.jpg",
      "avif": "/catalog/geocoding.avif",
      "alt": "Aerial landscape with winding roads."
    }
  },
  {
    "id": "reverse-geocode",
    "categoryId": "geocoding",
    "contractId": "geocoding.reverse",
    "params": {
      "lat": "51.5007",
      "lon": "-0.1246"
    },
    "name": "Reverse Geocoding",
    "shortName": "Reverse",
    "description": "Reverse Geocoding through one normalized geocoding.reverse contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 1.34,
        "p95LatencyMs": 192,
        "dataAgeMs": 44111,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 2.44,
        "p95LatencyMs": 233,
        "dataAgeMs": 48312,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/geocoding.jpg",
      "avif": "/catalog/geocoding.avif",
      "alt": "Aerial landscape with winding roads."
    }
  },
  {
    "id": "chat-general",
    "categoryId": "llm-chat",
    "contractId": "chat.complete",
    "params": {
      "model": "general"
    },
    "name": "General Chat Model",
    "shortName": "Chat",
    "description": "General Chat Model through one normalized chat.complete contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": true,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 4.44,
        "p95LatencyMs": 49,
        "dataAgeMs": 68902,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 5.54,
        "p95LatencyMs": 90,
        "dataAgeMs": 73103,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/chat-general.jpg",
      "avif": "/catalog/chat-general.avif",
      "alt": "Soft abstract neon lights in a dark field."
    }
  },
  {
    "id": "chat-reasoning",
    "categoryId": "llm-chat",
    "contractId": "chat.complete",
    "params": {
      "model": "reasoning"
    },
    "name": "Reasoning Chat Model",
    "shortName": "Reasoning",
    "description": "Reasoning Chat Model through one normalized chat.complete contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "model": "reasoning",
      "output": "The cheapest qualifying provider is DeepInfra: it meets the 400 ms P95 limit and bids below your max price.",
      "inputTokens": 180,
      "outputTokens": 64
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 6.14,
        "p95LatencyMs": 78,
        "dataAgeMs": 70809,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 7.24,
        "p95LatencyMs": 119,
        "dataAgeMs": 75010,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/llm-chat.jpg",
      "avif": "/catalog/llm-chat.avif",
      "alt": "Abstract neon lights in a dark field."
    }
  },
  {
    "id": "chat-json",
    "categoryId": "llm-chat",
    "contractId": "chat.complete",
    "params": {
      "model": "json"
    },
    "name": "Structured Output Model",
    "shortName": "JSON",
    "description": "Structured Output Model through one normalized chat.complete contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "model": "json",
      "output": "{\"provider\":\"deepinfra\",\"reason\":\"lowest qualifying bid\"}",
      "inputTokens": 96,
      "outputTokens": 22
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 7.84,
        "p95LatencyMs": 107,
        "dataAgeMs": 72716,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 8.94,
        "p95LatencyMs": 148,
        "dataAgeMs": 76917,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/llm-chat.jpg",
      "avif": "/catalog/llm-chat.avif",
      "alt": "Abstract neon lights in a dark field."
    }
  },
  {
    "id": "embed-general",
    "categoryId": "embeddings",
    "contractId": "embeddings.create",
    "params": {
      "model": "general"
    },
    "name": "General Embeddings",
    "shortName": "Embed",
    "description": "General Embeddings through one normalized embeddings.create contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 9.54,
        "p95LatencyMs": 136,
        "dataAgeMs": 74623,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.14,
        "p95LatencyMs": 177,
        "dataAgeMs": 78824,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/embeddings.jpg",
      "avif": "/catalog/embeddings.avif",
      "alt": "Abstract lines and shapes on black."
    }
  },
  {
    "id": "embed-multilingual",
    "categoryId": "embeddings",
    "contractId": "embeddings.create",
    "params": {
      "model": "multilingual"
    },
    "name": "Multilingual Embeddings",
    "shortName": "Multilingual",
    "description": "Multilingual Embeddings through one normalized embeddings.create contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "model": "multilingual",
      "vector": [
        0.0311,
        0.0062,
        -0.0712,
        0.0418
      ]
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 1.74,
        "p95LatencyMs": 165,
        "dataAgeMs": 76530,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 2.84,
        "p95LatencyMs": 206,
        "dataAgeMs": 80731,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/embeddings.jpg",
      "avif": "/catalog/embeddings.avif",
      "alt": "Abstract lines and shapes on black."
    }
  },
  {
    "id": "embed-code",
    "categoryId": "embeddings",
    "contractId": "embeddings.create",
    "params": {
      "model": "code"
    },
    "name": "Code Embeddings",
    "shortName": "Code",
    "description": "Code Embeddings through one normalized embeddings.create contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "model": "code",
      "dimensions": 768,
      "vector": [
        -0.0204,
        0.0541,
        0.0173,
        -0.0099
      ]
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.44,
        "p95LatencyMs": 194,
        "dataAgeMs": 78437,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.54,
        "p95LatencyMs": 235,
        "dataAgeMs": 82638,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/embeddings.jpg",
      "avif": "/catalog/embeddings.avif",
      "alt": "Abstract lines and shapes on black."
    }
  },
  {
    "id": "stt-english",
    "categoryId": "speech-to-text",
    "contractId": "speech.transcribe",
    "params": {
      "language": "en"
    },
    "name": "English Transcription",
    "shortName": "STT EN",
    "description": "English Transcription through one normalized speech.transcribe contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.14,
        "p95LatencyMs": 223,
        "dataAgeMs": 80344,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.24,
        "p95LatencyMs": 264,
        "dataAgeMs": 84545,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/speech-to-text.jpg",
      "avif": "/catalog/speech-to-text.avif",
      "alt": "Studio condenser microphone and pop filter."
    }
  },
  {
    "id": "stt-korean",
    "categoryId": "speech-to-text",
    "contractId": "speech.transcribe",
    "params": {
      "language": "ko"
    },
    "name": "Korean Transcription",
    "shortName": "STT KO",
    "description": "Korean Transcription through one normalized speech.transcribe contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": false,
    "sample": {
      "text": "날씨 요청을 300밀리초 이하의 가장 저렴한 공급자로 옮겨줘.",
      "language": "ko"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 6.84,
        "p95LatencyMs": 252,
        "dataAgeMs": 82251,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 7.94,
        "p95LatencyMs": 293,
        "dataAgeMs": 86452,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/speech-to-text.jpg",
      "avif": "/catalog/speech-to-text.avif",
      "alt": "Studio condenser microphone and pop filter."
    }
  },
  {
    "id": "stt-diarized",
    "categoryId": "speech-to-text",
    "contractId": "speech.transcribe",
    "params": {
      "language": "en"
    },
    "name": "Multi-speaker Transcription",
    "shortName": "STT speakers",
    "description": "Multi-speaker Transcription through one normalized speech.transcribe contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "text": "A: Is the weather feed still on Together? B: It switched to DeepInfra after the latency spike.",
      "speakers": 2,
      "durationSeconds": 6.4
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 8.54,
        "p95LatencyMs": 281,
        "dataAgeMs": 84158,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 9.64,
        "p95LatencyMs": 62,
        "dataAgeMs": 88359,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/speech-to-text.jpg",
      "avif": "/catalog/speech-to-text.avif",
      "alt": "Studio condenser microphone and pop filter."
    }
  },
  {
    "id": "tts-english",
    "categoryId": "text-to-speech",
    "contractId": "speech.synthesize",
    "params": {
      "voice": "en-neutral"
    },
    "name": "English Speech",
    "shortName": "TTS EN",
    "description": "English Speech through one normalized speech.synthesize contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.74,
        "p95LatencyMs": 50,
        "dataAgeMs": 86065,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.84,
        "p95LatencyMs": 91,
        "dataAgeMs": 90266,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/text-to-speech.jpg",
      "avif": "/catalog/text-to-speech.avif",
      "alt": "Abstract red and blue forms on black."
    }
  },
  {
    "id": "tts-korean",
    "categoryId": "text-to-speech",
    "contractId": "speech.synthesize",
    "params": {
      "voice": "ko-neutral"
    },
    "name": "Korean Speech",
    "shortName": "TTS KO",
    "description": "Korean Speech through one normalized speech.synthesize contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": false,
    "sample": {
      "voice": "ko-neutral"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 2.44,
        "p95LatencyMs": 79,
        "dataAgeMs": 87972,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.54,
        "p95LatencyMs": 120,
        "dataAgeMs": 92173,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/text-to-speech.jpg",
      "avif": "/catalog/text-to-speech.avif",
      "alt": "Abstract red and blue forms on black."
    }
  },
  {
    "id": "tts-stream",
    "categoryId": "text-to-speech",
    "contractId": "speech.synthesize",
    "params": {
      "voice": "en-stream"
    },
    "name": "Streaming Speech",
    "shortName": "TTS stream",
    "description": "Streaming Speech through one normalized speech.synthesize contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "voice": "en-stream",
      "format": "pcm",
      "durationSeconds": 2.8
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 4.14,
        "p95LatencyMs": 108,
        "dataAgeMs": 89879,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 5.24,
        "p95LatencyMs": 149,
        "dataAgeMs": 94080,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/text-to-speech.jpg",
      "avif": "/catalog/text-to-speech.avif",
      "alt": "Abstract red and blue forms on black."
    }
  },
  {
    "id": "image-square",
    "categoryId": "image-generation",
    "contractId": "images.generate",
    "params": {
      "size": "1024x1024"
    },
    "name": "Square Image Generation",
    "shortName": "Square",
    "description": "Square Image Generation through one normalized images.generate contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.84,
        "p95LatencyMs": 137,
        "dataAgeMs": 91786,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.94,
        "p95LatencyMs": 178,
        "dataAgeMs": 95987,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/image-generation.jpg",
      "avif": "/catalog/image-generation.avif",
      "alt": "Colorful abstract painted texture."
    }
  },
  {
    "id": "image-landscape",
    "categoryId": "image-generation",
    "contractId": "images.generate",
    "params": {
      "size": "1536x1024"
    },
    "name": "Landscape Image Generation",
    "shortName": "Landscape",
    "description": "Landscape Image Generation through one normalized images.generate contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "size": "1536x1024",
      "imageUrl": "https://tender.heyarca.app/images/landscape.png"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 7.54,
        "p95LatencyMs": 166,
        "dataAgeMs": 93693,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 8.64,
        "p95LatencyMs": 207,
        "dataAgeMs": 97894,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/image-generation.jpg",
      "avif": "/catalog/image-generation.avif",
      "alt": "Colorful abstract painted texture."
    }
  },
  {
    "id": "image-edit",
    "categoryId": "image-generation",
    "contractId": "images.edit",
    "params": {
      "operation": "inpaint"
    },
    "name": "Image Editing",
    "shortName": "Edit",
    "description": "Image Editing through one normalized images.edit contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 9.24,
        "p95LatencyMs": 195,
        "dataAgeMs": 95600,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.84,
        "p95LatencyMs": 236,
        "dataAgeMs": 99801,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/image-generation.jpg",
      "avif": "/catalog/image-generation.avif",
      "alt": "Colorful abstract painted texture."
    }
  },
  {
    "id": "translate-en-ko",
    "categoryId": "translation",
    "contractId": "translation.text",
    "params": {
      "source": "en",
      "target": "ko"
    },
    "name": "English to Korean Translation",
    "shortName": "EN → KO",
    "description": "English to Korean Translation through one normalized translation.text contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": true,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 1.44,
        "p95LatencyMs": 224,
        "dataAgeMs": 97507,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 2.54,
        "p95LatencyMs": 265,
        "dataAgeMs": 101708,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/translate-en-ko.jpg",
      "avif": "/catalog/translate-en-ko.avif",
      "alt": "Open book with fanned pages against a light background."
    }
  },
  {
    "id": "translate-ko-en",
    "categoryId": "translation",
    "contractId": "translation.text",
    "params": {
      "source": "ko",
      "target": "en"
    },
    "name": "Korean to English Translation",
    "shortName": "KO → EN",
    "description": "Korean to English Translation through one normalized translation.text contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Asia/Seoul",
    "source": "signal",
    "featured": false,
    "sample": {
      "translation": "Automatically switches to the best API.",
      "sourceLanguage": "ko",
      "targetLanguage": "en",
      "characters": 17
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.14,
        "p95LatencyMs": 253,
        "dataAgeMs": 99414,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.24,
        "p95LatencyMs": 294,
        "dataAgeMs": 103615,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/translation.jpg",
      "avif": "/catalog/translation.avif",
      "alt": "Open book with fanned pages."
    }
  },
  {
    "id": "language-detect",
    "categoryId": "translation",
    "contractId": "translation.detect",
    "params": {},
    "name": "Language Detection",
    "shortName": "Detect",
    "description": "Language Detection through one normalized translation.detect contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 4.84,
        "p95LatencyMs": 282,
        "dataAgeMs": 101321,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 5.94,
        "p95LatencyMs": 63,
        "dataAgeMs": 105522,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/translation.jpg",
      "avif": "/catalog/translation.avif",
      "alt": "Open book with fanned pages."
    }
  },
  {
    "id": "ocr-receipt",
    "categoryId": "document-parsing",
    "contractId": "documents.parse",
    "params": {
      "type": "receipt"
    },
    "name": "Receipt Parsing",
    "shortName": "Receipt",
    "description": "Receipt Parsing through one normalized documents.parse contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 6.54,
        "p95LatencyMs": 51,
        "dataAgeMs": 103228,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 7.64,
        "p95LatencyMs": 92,
        "dataAgeMs": 107429,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/document-ocr.jpg",
      "avif": "/catalog/document-ocr.avif",
      "alt": "Stack of paper documents from above."
    }
  },
  {
    "id": "ocr-invoice",
    "categoryId": "document-parsing",
    "contractId": "documents.parse",
    "params": {
      "type": "invoice"
    },
    "name": "Invoice Parsing",
    "shortName": "Invoice",
    "description": "Invoice Parsing through one normalized documents.parse contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "documentType": "invoice",
      "fields": {
        "invoiceNumber": "INV-2026-0418",
        "vendor": "Arca Labs",
        "total": 250.0,
        "currency": "USD",
        "dueDate": "2026-12-09"
      }
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 8.24,
        "p95LatencyMs": 80,
        "dataAgeMs": 105135,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 9.34,
        "p95LatencyMs": 121,
        "dataAgeMs": 109336,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/ocr-invoice.jpg",
      "avif": "/catalog/ocr-invoice.avif",
      "alt": "Organized stack of paper documents."
    }
  },
  {
    "id": "ocr-id",
    "categoryId": "document-parsing",
    "contractId": "documents.parse",
    "params": {
      "type": "id-card"
    },
    "name": "ID Card Parsing",
    "shortName": "ID card",
    "description": "ID Card Parsing through one normalized documents.parse contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {
      "documentType": "id-card",
      "fields": {
        "name": "Jane Doe",
        "documentNumber": "X1234567",
        "expiresOn": "2031-04-30",
        "country": "US"
      },
      "confidence": 94
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.44,
        "p95LatencyMs": 109,
        "dataAgeMs": 107042,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.54,
        "p95LatencyMs": 150,
        "dataAgeMs": 111243,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/document-ocr.jpg",
      "avif": "/catalog/document-ocr.avif",
      "alt": "Stack of paper documents from above."
    }
  },
  {
    "id": "ip-geo",
    "categoryId": "ip-intelligence",
    "contractId": "ip.lookup",
    "params": {
      "address": "203.0.113.10"
    },
    "name": "IP Location",
    "shortName": "IP location",
    "description": "IP Location through one normalized ip.lookup contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.04,
        "p95LatencyMs": 221,
        "dataAgeMs": 46018,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.14,
        "p95LatencyMs": 262,
        "dataAgeMs": 50219,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/ip-intelligence.jpg",
      "avif": "/catalog/ip-intelligence.avif",
      "alt": "Purple and blue abstract light network."
    }
  },
  {
    "id": "ip-asn",
    "categoryId": "ip-intelligence",
    "contractId": "ip.asn",
    "params": {
      "address": "203.0.113.10"
    },
    "name": "IP Network Lookup",
    "shortName": "ASN",
    "description": "IP Network Lookup through one normalized ip.asn contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 6.44,
        "p95LatencyMs": 279,
        "dataAgeMs": 49832,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 7.54,
        "p95LatencyMs": 60,
        "dataAgeMs": 54033,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/ip-intelligence.jpg",
      "avif": "/catalog/ip-intelligence.avif",
      "alt": "Purple and blue abstract light network."
    }
  },
  {
    "id": "ip-risk",
    "categoryId": "ip-intelligence",
    "contractId": "ip.risk",
    "params": {
      "address": "203.0.113.10"
    },
    "name": "IP Risk Score",
    "shortName": "IP risk",
    "description": "IP Risk Score through one normalized ip.risk contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 4.74,
        "p95LatencyMs": 250,
        "dataAgeMs": 47925,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 5.84,
        "p95LatencyMs": 291,
        "dataAgeMs": 52126,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/ip-risk.jpg",
      "avif": "/catalog/ip-risk.avif",
      "alt": "Purple and blue abstract network light."
    }
  },
  {
    "id": "email-verify",
    "categoryId": "contact-verification",
    "contractId": "email.verify",
    "params": {
      "address": "person@example.com"
    },
    "name": "Email Verification",
    "shortName": "Email",
    "description": "Email Verification through one normalized email.verify contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.74,
        "p95LatencyMs": 135,
        "dataAgeMs": 57460,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.84,
        "p95LatencyMs": 176,
        "dataAgeMs": 61661,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/contact-verification.jpg",
      "avif": "/catalog/contact-verification.avif",
      "alt": "Three blank white mail envelopes."
    }
  },
  {
    "id": "phone-verify",
    "categoryId": "contact-verification",
    "contractId": "phone.verify",
    "params": {
      "number": "+14155550100"
    },
    "name": "Phone Verification",
    "shortName": "Phone",
    "description": "Phone Verification through one normalized phone.verify contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.44,
        "p95LatencyMs": 164,
        "dataAgeMs": 59367,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.54,
        "p95LatencyMs": 205,
        "dataAgeMs": 63568,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/contact-verification.jpg",
      "avif": "/catalog/contact-verification.avif",
      "alt": "Three blank white mail envelopes."
    }
  },
  {
    "id": "email-risk",
    "categoryId": "contact-verification",
    "contractId": "email.risk",
    "params": {
      "address": "person@example.com"
    },
    "name": "Email Risk Check",
    "shortName": "Email risk",
    "description": "Email Risk Check through one normalized email.risk contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 7.14,
        "p95LatencyMs": 193,
        "dataAgeMs": 61274,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 8.24,
        "p95LatencyMs": 234,
        "dataAgeMs": 65475,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/contact-verification.jpg",
      "avif": "/catalog/contact-verification.avif",
      "alt": "Three blank white mail envelopes."
    }
  },
  {
    "id": "sanctions-screen",
    "categoryId": "kyc-screening",
    "contractId": "screening.sanctions",
    "params": {
      "name": "Jane Doe"
    },
    "name": "Sanctions Screening",
    "shortName": "Sanctions",
    "description": "Sanctions Screening through one normalized screening.sanctions contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 8.84,
        "p95LatencyMs": 222,
        "dataAgeMs": 63181,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 0.44,
        "p95LatencyMs": 263,
        "dataAgeMs": 67382,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/kyc-screening.jpg",
      "avif": "/catalog/kyc-screening.avif",
      "alt": "Passport silhouette against an airplane window."
    }
  },
  {
    "id": "pep-screen",
    "categoryId": "kyc-screening",
    "contractId": "screening.pep",
    "params": {
      "name": "Jane Doe"
    },
    "name": "PEP Screening",
    "shortName": "PEP",
    "description": "PEP Screening through one normalized screening.pep contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 1.04,
        "p95LatencyMs": 251,
        "dataAgeMs": 65088,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 2.14,
        "p95LatencyMs": 292,
        "dataAgeMs": 69289,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/kyc-screening.jpg",
      "avif": "/catalog/kyc-screening.avif",
      "alt": "Passport silhouette against an airplane window."
    }
  },
  {
    "id": "kyc-document",
    "categoryId": "kyc-screening",
    "contractId": "screening.document",
    "params": {
      "documentId": "passport"
    },
    "name": "ID Document Check",
    "shortName": "ID check",
    "description": "ID Document Check through one normalized screening.document contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 2.74,
        "p95LatencyMs": 280,
        "dataAgeMs": 66995,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.84,
        "p95LatencyMs": 61,
        "dataAgeMs": 71196,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/kyc-screening.jpg",
      "avif": "/catalog/kyc-screening.avif",
      "alt": "Passport silhouette against an airplane window."
    }
  },
  {
    "id": "company-profile",
    "categoryId": "company-data",
    "contractId": "companies.profile",
    "params": {
      "domain": "stripe.com"
    },
    "name": "Company Profile",
    "shortName": "Profile",
    "description": "Company Profile through one normalized companies.profile contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": true,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 8.14,
        "p95LatencyMs": 48,
        "dataAgeMs": 51739,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 9.24,
        "p95LatencyMs": 89,
        "dataAgeMs": 55940,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/company-profile.jpg",
      "avif": "/catalog/company-profile.avif",
      "alt": "Minimal glass-walled office corridor."
    }
  },
  {
    "id": "company-funding",
    "categoryId": "company-data",
    "contractId": "companies.funding",
    "params": {
      "domain": "stripe.com"
    },
    "name": "Company Funding",
    "shortName": "Funding",
    "description": "Company Funding through one normalized companies.funding contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 2.04,
        "p95LatencyMs": 106,
        "dataAgeMs": 55553,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.14,
        "p95LatencyMs": 147,
        "dataAgeMs": 59754,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/company-data.jpg",
      "avif": "/catalog/company-data.avif",
      "alt": "Glass-walled office corridor."
    }
  },
  {
    "id": "company-registry",
    "categoryId": "company-data",
    "contractId": "companies.registry",
    "params": {
      "jurisdiction": "US-DE",
      "number": "4675506"
    },
    "name": "Company Registry Record",
    "shortName": "Registry",
    "description": "Company Registry Record through one normalized companies.registry contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 0.34,
        "p95LatencyMs": 77,
        "dataAgeMs": 53646,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 1.44,
        "p95LatencyMs": 118,
        "dataAgeMs": 57847,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/company-data.jpg",
      "avif": "/catalog/company-data.avif",
      "alt": "Glass-walled office corridor."
    }
  },
  {
    "id": "web-search",
    "categoryId": "web-search",
    "contractId": "web.search",
    "params": {
      "query": "api marketplace"
    },
    "name": "Web Search",
    "shortName": "Search",
    "description": "Web Search through one normalized web.search contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": true,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 2.14,
        "p95LatencyMs": 138,
        "dataAgeMs": 108949,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 3.24,
        "p95LatencyMs": 179,
        "dataAgeMs": 113150,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/web-search.jpg",
      "avif": "/catalog/web-search.avif",
      "alt": "Magnifying glass on a blank white surface."
    }
  },
  {
    "id": "web-extract",
    "categoryId": "web-search",
    "contractId": "web.extract",
    "params": {
      "url": "https://tender.heyarca.app"
    },
    "name": "Page Content Extraction",
    "shortName": "Extract",
    "description": "Page Content Extraction through one normalized web.extract contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.84,
        "p95LatencyMs": 167,
        "dataAgeMs": 110856,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.94,
        "p95LatencyMs": 208,
        "dataAgeMs": 115057,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/web-search.jpg",
      "avif": "/catalog/web-search.avif",
      "alt": "Magnifying glass on a blank white surface."
    }
  },
  {
    "id": "web-metadata",
    "categoryId": "web-search",
    "contractId": "web.metadata",
    "params": {
      "url": "https://tender.heyarca.app"
    },
    "name": "Page Metadata",
    "shortName": "Metadata",
    "description": "Page Metadata through one normalized web.metadata contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "UTC",
    "source": "signal",
    "featured": false,
    "sample": {},
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.54,
        "p95LatencyMs": 196,
        "dataAgeMs": 112763,
        "errorRate": 0,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.64,
        "p95LatencyMs": 237,
        "dataAgeMs": 116964,
        "errorRate": 0.003,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/web-search.jpg",
      "avif": "/catalog/web-search.avif",
      "alt": "Magnifying glass on a blank white surface."
    }
  },
  {
    "id": "nba-score",
    "categoryId": "sports-scores",
    "contractId": "sports.score",
    "params": {
      "league": "NBA",
      "game": "nba-2026-11-09-lal-bos"
    },
    "name": "NBA Game Score",
    "shortName": "NBA",
    "description": "NBA Game Score through one normalized sports.score contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/New_York",
    "source": "signal",
    "featured": false,
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
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 1.64,
        "p95LatencyMs": 133,
        "dataAgeMs": 23134,
        "errorRate": 0.003,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 2.74,
        "p95LatencyMs": 174,
        "dataAgeMs": 27335,
        "errorRate": 0.002,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/sports-scores.jpg",
      "avif": "/catalog/sports-scores.avif",
      "alt": "Stadium floodlights glowing through falling snow."
    }
  },
  {
    "id": "epl-score",
    "categoryId": "sports-scores",
    "contractId": "sports.score",
    "params": {
      "league": "EPL",
      "game": "epl-2026-11-09-ars-che"
    },
    "name": "Premier League Match Score",
    "shortName": "EPL",
    "description": "Premier League Match Score through one normalized sports.score contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "Europe/London",
    "source": "signal",
    "featured": false,
    "sample": {
      "league": "EPL",
      "status": "live",
      "home": {
        "name": "Arsenal",
        "score": 1
      },
      "away": {
        "name": "Chelsea",
        "score": 1
      },
      "clock": "63'"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 3.34,
        "p95LatencyMs": 162,
        "dataAgeMs": 25041,
        "errorRate": 0.002,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 4.44,
        "p95LatencyMs": 203,
        "dataAgeMs": 29242,
        "errorRate": 0.001,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/sports-scores.jpg",
      "avif": "/catalog/sports-scores.avif",
      "alt": "Stadium floodlights glowing through falling snow."
    }
  },
  {
    "id": "mlb-score",
    "categoryId": "sports-scores",
    "contractId": "sports.score",
    "params": {
      "league": "MLB",
      "game": "mlb-2027-03-26-nyy-sf"
    },
    "name": "MLB Game Score",
    "shortName": "MLB",
    "description": "MLB Game Score through one normalized sports.score contract. Providers bid to serve each request; Tender routes to the best one that meets your policy.",
    "timeZone": "America/Los_Angeles",
    "source": "signal",
    "featured": false,
    "sample": {
      "league": "MLB",
      "status": "scheduled",
      "home": {
        "name": "San Francisco",
        "score": 0
      },
      "away": {
        "name": "New York",
        "score": 0
      },
      "startsAt": "2027-03-26T20:05:00Z"
    },
    "listings": [
      {
        "providerId": "the-zone-bio",
        "bidPrice": 5.04,
        "p95LatencyMs": 191,
        "dataAgeMs": 26948,
        "errorRate": 0.001,
        "available": true,
        "bias": 0.3
      },
      {
        "providerId": "arca-labs",
        "bidPrice": 6.14,
        "p95LatencyMs": 232,
        "dataAgeMs": 31149,
        "errorRate": 0,
        "available": true,
        "bias": -0.2
      }
    ],
    "image": {
      "src": "/catalog/sports-scores.jpg",
      "avif": "/catalog/sports-scores.avif",
      "alt": "Stadium floodlights glowing through falling snow."
    }
  }
];

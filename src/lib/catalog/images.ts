export type CatalogImagePath = {
  avif: string;
  jpg: string;
  alt: string;
};

export const CATALOG_IMAGE_PATHS: Record<string, CatalogImagePath> = {
  "sz-mlcc": {
    avif: "/catalog/sz-mlcc.avif",
    jpg: "/catalog/sz-mlcc.jpg",
    alt: "Close-up of ceramic capacitors on a circuit board.",
  },
  "lithium-carbonate": {
    avif: "/catalog/lithium-carbonate.avif",
    jpg: "/catalog/lithium-carbonate.jpg",
    alt: "Polished pale stone with crystalline veins.",
  },
  "freight-sha-lax": {
    avif: "/catalog/freight-sha-lax.avif",
    jpg: "/catalog/freight-sha-lax.jpg",
    alt: "Aerial view of shipping containers at a cargo port.",
  },
  "web-search": {
    avif: "/catalog/web-search.avif",
    jpg: "/catalog/web-search.jpg",
    alt: "Magnifying glass on a blank white surface.",
  },
};

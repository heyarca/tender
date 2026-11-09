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
};

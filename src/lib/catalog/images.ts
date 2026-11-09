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
};

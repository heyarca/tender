import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // @x402/next imports `next/server` without an extension; let Vite transform it.
        inline: ["@x402/next"],
      },
    },
  },
});

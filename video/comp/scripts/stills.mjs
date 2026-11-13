
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const frames = process.argv.slice(3).map(Number);
const outDir = process.argv[2];
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "TenderDemo" });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, output: path.join(outDir, `still-${String(frame).padStart(5, "0")}.png`), frame, chromiumOptions: { gl: "angle" } });
  console.log("still", frame, Date.now() - t0, "ms");
}

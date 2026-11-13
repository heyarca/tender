import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

const faces = ["PPMori-Book", "PPMori-Regular", "PPMori-Semibold"];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading PP Mori");
  Promise.all(
    faces.map((name) =>
      new FontFace(name, `url('${staticFile(`brand/${name}.woff2`)}') format('woff2')`).load().then((face) => {
        document.fonts.add(face);
      }),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err));
}

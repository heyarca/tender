import "./fonts";
import { Composition } from "remotion";
import { Main } from "./Main";
import { tl } from "./tl";

export const Root: React.FC = () => (
  <>
    <Composition id="TenderDemo" component={Main} durationInFrames={tl.durationInFrames} fps={tl.fps} width={tl.width} height={tl.height} />
  </>
);

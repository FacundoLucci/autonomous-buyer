import { Composition, registerRoot } from "remotion";
import { FootageFilm } from "./FootageFilm";

const Root = () => (
  <Composition
    id="YouHandleTodayReview"
    component={FootageFilm}
    durationInFrames={4320}
    fps={24}
    width={1920}
    height={1080}
    defaultProps={{ captions: true }}
  />
);
registerRoot(Root);

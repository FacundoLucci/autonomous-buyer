import { Composition, registerRoot } from "remotion";
import { CompleteFilm } from "./CompleteFilm";

const Root = () => (
  <>
    <Composition
      id="YouHandleToday"
      component={CompleteFilm}
      durationInFrames={4320}
      fps={24}
      width={1920}
      height={1080}
      defaultProps={{ guide: false }}
    />
    <Composition
      id="YouHandleTodayGuide"
      component={CompleteFilm}
      durationInFrames={4320}
      fps={24}
      width={1920}
      height={1080}
      defaultProps={{ guide: true }}
    />
  </>
);
registerRoot(Root);

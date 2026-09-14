import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { dotMatrixDriver } from "../../src/components/desk/dot-matrix-driver";
import timeline from "./complete-manifest.json";
import mobileFrames from "./mobile-frame-map.json";

const lime = "#dce985";
const ink = "#15170f";
const pale = "#eef1d5";
const mono = '"SFMono-Regular", Menlo, Consolas, monospace';
const brand = dotMatrixDriver.rasterize("BUY HARD");
const fps = 24;

type Scene = {
  start: number;
  duration: number;
  layout: string;
  eyebrow: string;
  title?: string;
  body?: string;
  shot?: string;
  poster?: string;
  loud?: boolean;
  app?: { start: number; duration: number; crop?: number[] };
};
export type CompleteFilmProps = { narrator?: string; voiceover?: string; guide?: boolean };

function Wordmark({ width = 224 }: { width?: number }) {
  return (
    <svg width={width} viewBox={`0 0 ${brand.columns} ${brand.rows}`} aria-label="BUY HARD">
      {Array.from(brand.pixels).map((pixel, i) =>
        pixel ? (
          <circle
            key={i}
            cx={(i % brand.columns) + 0.5}
            cy={Math.floor(i / brand.columns) + 0.5}
            r={0.36}
            fill={ink}
          />
        ) : null,
      )}
    </svg>
  );
}

function Footage({ scene, style }: { scene: Scene; style?: CSSProperties }) {
  return (
    <div style={{ ...style, overflow: "hidden", background: lime }}>
      {scene.shot ? (
        <OffthreadVideo
          src={staticFile(`footage/${scene.shot}.mp4`)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          volume={scene.loud ? 0.65 : 0.12}
        />
      ) : scene.poster ? (
        <Img
          src={staticFile(`footage/${scene.poster}.png`)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : null}
    </div>
  );
}

/** The window crops recorded pixels; it never recreates the product UI. */
function Mobile({ scene, detail = false }: { scene: Scene; detail?: boolean }) {
  const frame = useCurrentFrame();
  const app = scene.app!;
  const last = Math.max(0, Math.round(app.duration * fps) - 1);
  const crop = detail ? (app.crop ?? [17, 96, 326, 430]) : [0, 0, 360, 780];
  const [x, y, width, height] = crop;
  const scale = detail ? Math.min(904 / width, 752 / height) : 1;
  return (
    <div
      style={{
        width: width * scale,
        height: height * scale,
        overflow: "hidden",
        position: "relative",
        outline: `1px solid ${ink}33`,
        flexShrink: 0,
      }}
    >
      <Img
        src={staticFile(
          `footage/mobile-frames/${mobileFrames.frames[Math.round(app.start * fps) + Math.min(frame, last)]}`,
        )}
        style={{
          position: "absolute",
          width: 360 * scale,
          height: 780 * scale,
          maxWidth: "none",
          left: -x * scale,
          top: -y * scale,
        }}
      />
    </div>
  );
}

function Kicker({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize: 20,
        lineHeight: 1.5,
        letterSpacing: 0.6,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
}

function SceneFrame({ scene }: { scene: Scene }) {
  if (scene.layout === "end")
    return (
      <div style={{ position: "absolute", top: 175, left: 230, right: 100 }}>
        <Wordmark width={1100} />
        <h1
          style={{
            fontSize: 128,
            lineHeight: 0.98,
            letterSpacing: -7,
            margin: "70px 0 35px",
            whiteSpace: "pre-line",
          }}
        >
          {scene.title}
        </h1>
        <p style={{ fontSize: 35 }}>{scene.body}</p>
      </div>
    );
  if (scene.layout === "full")
    return (
      <>
        <Footage
          scene={scene}
          style={{ position: "absolute", left: 48, right: 48, top: 90, height: 792 }}
        />
        <div
          style={{
            position: "absolute",
            top: 110,
            left: 66,
            padding: "12px 18px",
            background: pale,
            border: `1px solid ${ink}`,
          }}
        >
          <Kicker text={scene.eyebrow} />
        </div>
        {scene.title && (
          <h1
            style={{
              position: "absolute",
              left: 150,
              top: 675,
              maxWidth: 1150,
              fontSize: 66,
              letterSpacing: -3.6,
              lineHeight: 1.05,
              margin: 0,
              padding: "18px 24px",
              background: lime,
            }}
          >
            {scene.title}
          </h1>
        )}
      </>
    );
  if (scene.layout === "parallel")
    return (
      <>
        <div style={{ position: "absolute", top: 102, left: 64 }}>
          <Kicker text={scene.eyebrow} />
        </div>
        <Footage
          scene={scene}
          style={{ position: "absolute", top: 157, left: 48, width: 1300, height: 731.25 }}
        />
        <div
          style={{
            position: "absolute",
            left: 1444,
            top: 98,
            padding: "0 0 0 38px",
            borderLeft: `1px solid ${ink}55`,
          }}
        >
          <Mobile scene={scene} />
        </div>
      </>
    );
  if (scene.layout === "detail" || scene.layout === "phone")
    return (
      <>
        <div style={{ position: "absolute", left: 214, top: 190, width: 646 }}>
          <Kicker text={scene.eyebrow} />
          <h1
            style={{
              fontSize: 79,
              lineHeight: 1.02,
              letterSpacing: -4.6,
              margin: "33px 0",
              whiteSpace: "pre-line",
            }}
          >
            {scene.title}
          </h1>
          {scene.body && (
            <p style={{ fontSize: 33, lineHeight: 1.35, maxWidth: 620 }}>{scene.body}</p>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 922,
            top: 106,
            width: 936,
            height: 770,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mobile scene={scene} detail={scene.layout === "detail"} />
        </div>
      </>
    );
  if (scene.poster)
    return (
      <>
        <Footage
          scene={scene}
          style={{ position: "absolute", top: 186, left: 40, width: 1080, height: 607.5 }}
        />
        <div style={{ position: "absolute", left: 1175, top: 220, width: 670 }}>
          <Kicker text={scene.eyebrow} />
          <h1
            style={{ fontSize: 72, letterSpacing: -3.9, lineHeight: 1.03, whiteSpace: "pre-line" }}
          >
            {scene.title}
          </h1>
          <p style={{ fontSize: 35, lineHeight: 1.35 }}>{scene.body}</p>
        </div>
      </>
    );
  return (
    <div
      style={{
        position: "absolute",
        left: 220,
        top: 160,
        right: 150,
        bottom: 245,
        background: pale,
        padding: "55px 66px",
        borderTop: `2px solid ${ink}`,
        borderBottom: `1px solid ${ink}`,
      }}
    >
      <Kicker text={scene.eyebrow} />
      <h1
        style={{
          fontSize: 104,
          lineHeight: 1.03,
          letterSpacing: -5.5,
          margin: "35px 0",
          whiteSpace: "pre-line",
        }}
      >
        {scene.title}
      </h1>
      <p style={{ fontSize: 39, lineHeight: 1.3 }}>{scene.body}</p>
    </div>
  );
}

export function CompleteFilm({ narrator, voiceover, guide = false }: CompleteFilmProps) {
  const time = useCurrentFrame() / fps;
  const cue = timeline.captions.find((c) => time >= c.start && time < c.end);
  return (
    <AbsoluteFill
      style={{ background: lime, color: ink, fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {(timeline.scenes as Scene[]).map((scene) => (
        <Sequence
          key={scene.start}
          from={Math.round(scene.start * fps)}
          durationInFrames={Math.round(scene.duration * fps)}
          layout="none"
        >
          <SceneFrame scene={scene} />
        </Sequence>
      ))}
      <header
        style={{
          position: "absolute",
          top: 25,
          left: 48,
          right: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Wordmark />
        <span style={{ font: `18px ${mono}`, letterSpacing: 1 }}>YOU HANDLE TODAY.</span>
      </header>
      <div
        style={{
          position: "absolute",
          left: 28,
          right: 28,
          top: 906,
          borderTop: `1px solid ${ink}80`,
        }}
      />
      {narrator && (
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 920,
            width: 144,
            height: 144,
            borderRadius: "50%",
            overflow: "hidden",
          }}
        >
          <OffthreadVideo
            src={narrator.startsWith("http") ? narrator : staticFile(narrator)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      {guide && cue && (
        <div
          style={{
            position: "absolute",
            left: 230,
            right: 80,
            top: 930,
            fontSize: 36,
            lineHeight: 1.26,
          }}
        >
          {cue.text}
        </div>
      )}
      {voiceover && (
        <Audio src={voiceover.startsWith("http") ? voiceover : staticFile(voiceover)} />
      )}
    </AbsoluteFill>
  );
}

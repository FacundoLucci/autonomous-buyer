import type { CSSProperties, ReactNode } from "react";
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
import timeline from "./footage-manifest.json";

const lime = "#dce985";
const ink = "#15170f";
const pale = "#eef1d5";
const mono = '"SFMono-Regular", Menlo, Consolas, monospace';
const font = "Arial, Helvetica, sans-serif";
const brand = dotMatrixDriver.rasterize("BUY HARD");
const src = (file: string) => staticFile("footage/" + file);
type Scene = (typeof timeline.scenes)[number];
export type FootageFilmProps = { narrator?: string; voiceover?: string; captions?: boolean };

function Wordmark({ width = 250 }: { width?: number }) {
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

function Picture({ scene, split = false }: { scene: Scene; split?: boolean }) {
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: split ? "cover" : "contain",
    objectPosition: scene.focus ?? "center",
  };
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: lime }}>
      {scene.shot ? (
        <OffthreadVideo
          src={src(scene.shot + ".mp4")}
          style={style}
          volume={scene.loud ? 0.7 : 0.14}
        />
      ) : scene.poster ? (
        <Img src={src(scene.poster + ".png")} style={style} />
      ) : null}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize: 22,
        lineHeight: 1.45,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 30,
      }}
    >
      {children}
    </div>
  );
}

function Copy({ scene, split = false }: { scene: Scene; split?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <Label>{scene.eyebrow}</Label>
      {scene.title && (
        <h1
          style={{
            margin: "0 0 32px",
            fontSize: split ? 72 : 94,
            lineHeight: 1.03,
            letterSpacing: split ? -4 : -5,
            fontWeight: 800,
            whiteSpace: "pre-line",
          }}
        >
          {scene.title}
        </h1>
      )}
      {scene.body && (
        <p
          style={{
            margin: 0,
            fontSize: split ? 39 : 49,
            lineHeight: 1.31,
            whiteSpace: "pre-line",
            maxWidth: split ? 750 : 1460,
          }}
        >
          {scene.body}
        </p>
      )}
      {scene.rows && (
        <div style={{ marginTop: 6, borderTop: `2px solid ${ink}` }}>
          {scene.rows.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "grid",
                gridTemplateColumns: split ? "1fr" : "1fr 1.15fr",
                gap: split ? 8 : 35,
                padding: split ? "23px 0" : "25px 0",
                borderBottom: `1px solid ${ink}`,
                fontSize: split ? 33 : 39,
                lineHeight: 1.25,
              }}
            >
              <span>{label}</span>
              <strong style={{ fontWeight: 700 }}>{value}</strong>
            </div>
          ))}
        </div>
      )}
      {scene.note && (
        <p
          style={{
            margin: "27px 0 0",
            fontSize: split ? 25 : 29,
            lineHeight: 1.35,
            fontFamily: mono,
          }}
        >
          {scene.note}
        </p>
      )}
    </div>
  );
}

function SceneFrame({ scene }: { scene: Scene }) {
  if (scene.layout === "end")
    return (
      <div
        style={{
          position: "absolute",
          top: 118,
          left: 240,
          right: 110,
          bottom: 230,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Wordmark width={1180} />
        <h1
          style={{
            fontSize: 112,
            letterSpacing: -6,
            lineHeight: 0.98,
            margin: "62px 0 30px",
            whiteSpace: "pre-line",
          }}
        >
          {scene.title}
        </h1>
        <p style={{ fontSize: 34, margin: 0 }}>{scene.eyebrow}</p>
      </div>
    );
  if (scene.layout === "full")
    return (
      <>
        <div style={{ position: "absolute", top: 82, left: 28, right: 28, height: 798 }}>
          <Picture scene={scene} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 66,
            maxWidth: 470,
            padding: "18px 23px",
            background: pale,
            border: `1px solid ${ink}`,
            fontFamily: mono,
            fontSize: 21,
            lineHeight: 1.4,
          }}
        >
          {scene.eyebrow}
        </div>
        {scene.title && (
          <div
            style={{
              position: "absolute",
              left: 70,
              top: 650,
              padding: "20px 30px",
              background: lime,
              maxWidth: 940,
              fontSize: 69,
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: -3,
            }}
          >
            {scene.title}
          </div>
        )}
      </>
    );
  if (scene.layout === "split")
    return (
      <div
        style={{
          position: "absolute",
          left: 28,
          right: 28,
          top: 96,
          height: 772,
          display: "grid",
          gridTemplateColumns: "960px 1fr",
          borderTop: `1px solid ${ink}`,
          borderBottom: `1px solid ${ink}`,
        }}
      >
        <Picture scene={scene} split />
        <div style={{ padding: "40px 44px", background: pale, borderLeft: `2px solid ${ink}` }}>
          <Copy scene={scene} split />
        </div>
      </div>
    );
  return (
    <div
      style={{
        position: "absolute",
        top: 104,
        left: 120,
        right: 100,
        height: 762,
        padding: "40px 62px",
        borderTop: `2px solid ${ink}`,
        borderBottom: `1px solid ${ink}`,
        background: pale,
      }}
    >
      <Copy scene={scene} />
    </div>
  );
}

export function FootageFilm({ narrator, voiceover, captions = true }: FootageFilmProps) {
  const frame = useCurrentFrame();
  const seconds = frame / 24;
  const cue = timeline.captions.find((c) => seconds >= c.start && seconds < c.end);
  return (
    <AbsoluteFill style={{ background: lime, color: ink, fontFamily: font }}>
      {timeline.scenes.map((scene) => (
        <Sequence
          key={scene.start}
          from={scene.start * 24}
          durationInFrames={scene.duration * 24}
          layout="none"
        >
          <SceneFrame scene={scene} />
        </Sequence>
      ))}
      <header
        style={{
          position: "absolute",
          top: 24,
          left: 30,
          right: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark />
        <span style={{ fontFamily: mono, fontSize: 20, letterSpacing: 0.5 }}>
          STORYBOARD · ILLUSTRATIVE BUYER SEQUENCE
        </span>
      </header>
      <div
        style={{
          position: "absolute",
          top: 895,
          left: 24,
          right: 24,
          borderTop: `2px solid ${ink}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 916,
          left: 28,
          width: 148,
          height: 148,
          borderRadius: "50%",
          border: `2px solid ${ink}`,
          overflow: "hidden",
          background: pale,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {narrator ? (
          <OffthreadVideo
            src={narrator.startsWith("http") ? narrator : staticFile(narrator)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ textAlign: "center", fontFamily: mono, fontSize: 18, lineHeight: 1.45 }}>
            FACUNDO
            <br />
            <span style={{ fontSize: 14 }}>Camera space</span>
          </div>
        )}
      </div>
      {captions && cue && (
        <div
          style={{
            position: "absolute",
            left: 230,
            right: 80,
            top: 924,
            height: 132,
            display: "flex",
            alignItems: "center",
            fontSize: 39,
            lineHeight: 1.26,
            letterSpacing: -0.5,
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

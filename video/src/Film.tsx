import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { DURATION_FRAMES, FPS, scenes, type FilmProps, type Scene, type Shot } from "./manifest";

const palette = {
  ink: "#090b0b",
  green: "#182820",
  acid: "#d6ed73",
  cream: "#e7e4d9",
  muted: "#9da99c",
  line: "#394639",
};
const mono = '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
const sans = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const source = (path: string) => (/^(https?:|data:)/.test(path) ? path : staticFile(path));

function FilmGrain() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.08,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23n)' opacity='.4' d='M0 0h180v180H0z'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

function Capture({
  shot,
  motion,
  deliClip,
  width = 1776,
  height = 764,
}: {
  shot: Shot;
  motion: FilmProps["motion"];
  deliClip?: FilmProps["deliClip"];
  width?: number;
  height?: number;
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, shot.duration * FPS - 1)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const [startScale, endScale] = shot.scale ?? [1, 1.03];
  const scale = startScale + (endScale - startScale) * progress;
  const [focusX, focusY] = shot.focus ?? [0.5, 0.5];
  const clip = deliClip ?? motion[shot.capture];
  const baseScale = Math.min(width / 1920, height / 1080);
  const camera = shot.camera;
  const travel =
    camera && !deliClip
      ? interpolate(
          frame,
          [(camera.context ?? 1.5) * FPS, ((camera.context ?? 1.5) + (camera.travel ?? 3.5)) * FPS],
          [0, 1],
          { ...clamp, easing: ease },
        )
      : 0;
  const pixelScale = baseScale + ((camera?.scale ?? baseScale) - baseScale) * travel;
  const desiredCenterX = 960 + ((camera?.x ?? 960) - 960) * travel;
  const desiredCenterY = 540 + ((camera?.y ?? 540) - 540) * travel;
  const visibleHalfWidth = width / pixelScale / 2;
  const visibleHalfHeight = height / pixelScale / 2;
  const centerX =
    visibleHalfWidth > 960
      ? 960
      : Math.max(visibleHalfWidth, Math.min(1920 - visibleHalfWidth, desiredCenterX));
  const centerY =
    visibleHalfHeight > 540
      ? 540
      : Math.max(visibleHalfHeight, Math.min(1080 - visibleHalfHeight, desiredCenterY));
  const style: CSSProperties =
    camera && !deliClip
      ? {
          position: "absolute",
          left: width / 2 - centerX * pixelScale,
          top: height / 2 - centerY * pixelScale,
          width: 1920 * pixelScale,
          height: 1080 * pixelScale,
          maxWidth: "none",
        }
      : {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${scale})`,
          transformOrigin: `${focusX * 100}% ${focusY * 100}%`,
        };
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: palette.ink }}>
      {clip && (clip.durationInFrames === undefined || frame < clip.durationInFrames) ? (
        <Video
          src={source(clip.src)}
          muted
          trimBefore={clip.trimBefore ?? 0}
          playbackRate={clip.playbackRate ?? 1}
          style={style}
          onError={() => "fail"}
        />
      ) : (
        <Img src={staticFile(`captures/${shot.capture}.png`)} style={style} />
      )}
    </AbsoluteFill>
  );
}

function Caption({ scene, currentShot }: { scene: Scene; currentShot: Shot }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 22], [0, 1], { ...clamp, easing: ease });
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        top: 72,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "end",
        transform: `translateY(${(1 - enter) * 18}px)`,
        opacity: enter,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: mono,
            color: palette.acid,
            fontSize: 19,
            letterSpacing: 3,
            marginBottom: 13,
          }}
        >
          {scene.chapter}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 650,
            fontSize: 52,
            letterSpacing: -2,
            color: palette.cream,
          }}
        >
          {scene.title}
        </div>
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 17,
          color: palette.muted,
          textAlign: "right",
          maxWidth: 420,
          lineHeight: 1.7,
        }}
      >
        {currentShot.note}
      </div>
    </div>
  );
}

function Opening({ scene, props }: { scene: Scene; props: FilmProps }) {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [0, 34], [45, 0], { ...clamp, easing: ease });
  const reveal = interpolate(frame, [0, 34], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 56,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
        }}
      >
        <div style={{ color: palette.acid, font: `18px ${mono}`, letterSpacing: 3 }}>
          BUY HARD / A RECORDED DEMO PURCHASE
        </div>
        <div style={{ color: palette.muted, font: `18px ${mono}` }}>PC-0180</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          top: 106,
          fontFamily: sans,
          fontSize: 104,
          lineHeight: 1,
          letterSpacing: -5,
          fontWeight: 700,
          color: palette.cream,
          opacity: reveal,
          transform: `translateY(${lift}px)`,
        }}
      >
        Why pay <span style={{ color: palette.acid }}>$400</span> more?
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 250,
          height: 686,
          border: `1px solid ${palette.line}`,
          boxShadow: "0 28px 90px #0008",
        }}
      >
        <Capture shot={scene.shots[0]} motion={props.motion} height={686} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          top: 969,
          font: `22px ${mono}`,
          color: palette.cream,
        }}
      >
        The cheaper quote. The recommended quote. The reason.
      </div>
    </AbsoluteFill>
  );
}

function ScenePicture({ scene, index, props }: { scene: Scene; index: number; props: FilmProps }) {
  const frame = useCurrentFrame();
  const currentSecond = frame / FPS;
  const currentShot =
    scene.shots.find(
      (shot) => currentSecond >= shot.start && currentSecond < shot.start + shot.duration,
    ) ?? scene.shots[scene.shots.length - 1];
  const fadeIn = interpolate(frame, [0, 10], [0, 1], clamp);
  const fadeOut = interpolate(
    frame,
    [scene.duration * FPS - 8, scene.duration * FPS],
    [1, 0],
    clamp,
  );
  const closingCard =
    scene.id === "closing"
      ? interpolate(frame, [5 * FPS, 6 * FPS], [0, 1], { ...clamp, easing: ease })
      : 0;
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {scene.id === "question" ? (
        <Opening scene={scene} props={props} />
      ) : (
        <>
          <Caption scene={scene} currentShot={currentShot} />
          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              top: 204,
              bottom: 112,
              border: `1px solid ${palette.line}`,
              background: palette.ink,
              boxShadow: "0 24px 70px #0007",
              overflow: "hidden",
            }}
          >
            {scene.shots.map((shot) => (
              <Sequence
                key={`${scene.id}-${shot.capture}`}
                from={shot.start * FPS}
                durationInFrames={shot.duration * FPS}
                name={shot.note}
              >
                <Capture
                  shot={shot}
                  motion={props.motion}
                  deliClip={scene.id === "owner" ? props.deliClip : undefined}
                />
              </Sequence>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              left: 72,
              bottom: 61,
              color: palette.cream,
              font: `23px ${mono}`,
            }}
          >
            {scene.caption}
          </div>
          <div
            style={{
              position: "absolute",
              right: 72,
              bottom: 63,
              color: palette.muted,
              font: `18px ${mono}`,
            }}
          >
            {String(index + 1).padStart(2, "0")} / 09
          </div>
        </>
      )}
      {scene.id === "closing" && (
        <AbsoluteFill
          style={{
            opacity: closingCard,
            background: palette.acid,
            color: palette.ink,
            justifyContent: "center",
            padding: "0 112px",
          }}
        >
          <div style={{ font: `21px ${mono}`, letterSpacing: 5, marginBottom: 35 }}>
            THE $400 DECISION
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: 218,
              letterSpacing: -15,
              lineHeight: 0.85,
              fontWeight: 900,
            }}
          >
            BUY HARD
          </div>
          <div style={{ fontFamily: sans, fontSize: 67, letterSpacing: -3, marginTop: 50 }}>
            Keep the line moving.
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 92,
              left: 112,
              right: 112,
              borderTop: "1px solid #18282066",
              paddingTop: 24,
              display: "flex",
              justifyContent: "space-between",
              font: `21px ${mono}`,
            }}
          >
            <span>{props.judgeUrl}</span>
            <span>EXPLORE THE RECORDED PURCHASE ↗</span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function VoiceCues({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const sentences = scene.narration.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [scene.narration];
  const wordCounts = sentences.map((sentence) => sentence.trim().split(/\s+/).length);
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
  const currentSentence =
    sentences.find(
      (_, i) =>
        frame <
        (wordCounts.slice(0, i + 1).reduce((sum, count) => sum + count, 0) / totalWords) *
          scene.duration *
          FPS,
    ) ?? sentences[sentences.length - 1];
  const totalSecond = scene.from + Math.floor(frame / FPS);
  const timecode = `${Math.floor(totalSecond / 60)}:${String(totalSecond % 60).padStart(2, "0")}`;
  return (
    <div
      style={{
        position: "absolute",
        left: 112,
        right: 112,
        bottom: 140,
        padding: "23px 30px",
        background: "#090b0bf2",
        border: `1px solid ${palette.acid}`,
        color: palette.cream,
        boxShadow: "0 15px 45px #0007",
      }}
    >
      <div
        style={{ font: `16px ${mono}`, color: palette.acid, marginBottom: 12, letterSpacing: 2 }}
      >
        VOICEOVER REHEARSAL / {timecode} / {scene.id.toUpperCase()}
      </div>
      <div style={{ fontFamily: sans, fontSize: 34, lineHeight: 1.35 }}>
        {currentSentence.trim()}
      </div>
    </div>
  );
}

export function Film(props: FilmProps) {
  const frame = useCurrentFrame();
  if (props.voiceover && props.voiceClips.length)
    throw new Error("Use a single voiceover OR per-scene voiceClips, not both.");
  return (
    <AbsoluteFill style={{ background: palette.ink, color: palette.cream, fontFamily: sans }}>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at 80% 0%, #263e2b55 0%, transparent 60%)" }}
      />
      {scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={scene.from * FPS}
          durationInFrames={scene.duration * FPS}
          name={`${String(index + 1).padStart(2, "0")} · ${scene.title}`}
        >
          <ScenePicture scene={scene} index={index} props={props} />
          {props.cues && <VoiceCues scene={scene} />}
        </Sequence>
      ))}
      <FilmGrain />
      <div
        style={{
          position: "absolute",
          top: 0,
          height: 3,
          left: 0,
          width: `${(frame / (DURATION_FRAMES - 1)) * 100}%`,
          background: palette.acid,
        }}
      />
      {frame < 158 * FPS && (
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 22,
            color: palette.muted,
            font: `12px ${mono}`,
            letterSpacing: 2,
          }}
        >
          RECORDED RUN · WAITING TIME COMPRESSED
        </div>
      )}
      {props.voiceover && <Audio src={source(props.voiceover)} onError={() => "fail"} />}
      {props.voiceClips.map((clip) => {
        const scene = scenes.find((entry) => entry.id === clip.sceneId);
        if (!scene) throw new Error(`Unknown voiceover scene: ${clip.sceneId}`);
        return (
          <Sequence
            key={clip.sceneId}
            from={scene.from * FPS}
            durationInFrames={clip.durationInFrames ?? scene.duration * FPS}
            name={`Voice · ${scene.id}`}
          >
            <Audio
              src={source(clip.src)}
              trimBefore={clip.trimBefore ?? 0}
              onError={() => "fail"}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

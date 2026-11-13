import { AbsoluteFill, Audio, Easing, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { clamp, INK, LIME, OLIVE, tl } from "./tl";
import type { PopupT, SceneT, Segment } from "./types";
import { Wordmark } from "./Wordmark";

const { window: win, content, topBar, radius } = tl.layout;
const ease = Easing.bezier(0.33, 0, 0.2, 1);

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #f6f6f5 0%, #eeedea 100%)" }}>
    <AbsoluteFill style={{ background: "radial-gradient(130% 100% at 50% 42%, rgba(3,8,10,0) 58%, rgba(3,8,10,0.06) 100%)" }} />
    <Stage />
    <Chapters />
    <Captions />
    <TitleCard />
    <EndCard />
    {tl.vo.map((v, i) => (
      <Sequence key={i} from={v.from} durationInFrames={v.dur} layout="none">
        <Audio src={staticFile(v.src)} trimBefore={v.trimBefore} />
      </Sequence>
    ))}
    {tl.music ? <Audio src={staticFile(tl.music.src)} loop volume={(f) => tl.music!.volume[f] ?? 0} /> : null}
  </AbsoluteFill>
);

// ---------------------------------------------------------------- stage: window, popups and cursor under one camera
const Stage: React.FC = () => {
  const f = useCurrentFrame();
  const z = tl.camera.z[f] ?? 1;
  const x = tl.camera.x[f] ?? tl.width / 2;
  const y = tl.camera.y[f] ?? tl.height / 2;
  const reveal = interpolate(f, [tl.title.dur - tl.title.out, tl.title.dur], [0, 1], { ...clamp, easing: ease });
  const outro = interpolate(f, [tl.end.from, tl.end.from + 18], [1, 0], clamp);
  const s = z * (0.965 + 0.035 * reveal);
  return (
    <AbsoluteFill style={{ opacity: Math.min(reveal, outro) }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: tl.width,
          height: tl.height,
          transformOrigin: "0 0",
          transform: `translate(${tl.width / 2}px, ${tl.height / 2}px) scale(${s}) translate(${-x}px, ${-y}px)`,
        }}
      >
        <AppWindow />
        {tl.scenes.map((sc) =>
          sc.kind === "clip" ? (
            <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur} layout="none">
              {sc.popups.map((p, i) => (
                <PopupWindow key={i} scene={sc} popup={p} />
              ))}
              <Cursor scene={sc} />
            </Sequence>
          ) : null,
        )}
      </div>
    </AbsoluteFill>
  );
};

const AppWindow: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: win.x,
      top: win.y,
      width: win.w,
      height: win.h,
      borderRadius: radius,
      overflow: "hidden",
      background: "#ffffff",
      boxShadow: "0 0 0 1px rgba(3,8,10,0.08), 0 28px 80px rgba(3,8,10,0.13), 0 6px 20px rgba(3,8,10,0.05)",
    }}
  >
    <TopBar host="tender.heyarca.app" />
    <div style={{ position: "absolute", left: 0, top: topBar, width: content.w, height: content.h, overflow: "hidden", background: "#f5f5f5" }}>
      {tl.scenes.map((sc) =>
        sc.kind === "clip" && sc.clip ? (
          <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur}>
            <SceneVideo scene={sc} src={sc.clip} />
          </Sequence>
        ) : null,
      )}
    </div>
  </div>
);

const TopBar: React.FC<{ host: string }> = ({ host }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      right: 0,
      height: topBar,
      background: "#fbfbfa",
      borderBottom: "1px solid rgba(3,8,10,0.07)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "PPMori-Book",
      fontSize: 13,
      color: "rgba(3,8,10,0.45)",
      letterSpacing: "0.01em",
    }}
  >
    {host}
  </div>
);

const SceneVideo: React.FC<{ scene: SceneT; src: string }> = ({ scene, src }) => {
  const f = useCurrentFrame();
  const opacity = scene.xfadeIn ? interpolate(f, [0, scene.xfadeIn], [0, 1], clamp) : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      {scene.segments.map((g, i) => (
        <Sequence key={i} from={g.from} durationInFrames={g.dur}>
          <SegmentVideo segment={g} src={staticFile(src)} redact={scene.redact} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SegmentVideo: React.FC<{ segment: Segment; src: string; redact?: SceneT["redact"] }> = ({ segment, src, redact = [] }) => {
  const f = useCurrentFrame();
  const opacity = segment.fadeIn ? interpolate(f, [0, segment.fadeIn], [0, 1], clamp) : 1;
  const t = (segment.srcFrame + f * segment.rate) / tl.fps;
  const video = (style: React.CSSProperties) =>
    segment.rate === 0 ? (
      <Freeze frame={0}>
        <OffthreadVideo src={src} trimBefore={segment.srcFrame} muted style={style} />
      </Freeze>
    ) : (
      <OffthreadVideo src={src} trimBefore={segment.srcFrame} playbackRate={segment.rate} muted style={style} />
    );
  return (
    <AbsoluteFill style={{ opacity }}>
      {video({ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" })}
      {redact
        .filter((r) => t >= r.from && t < r.to)
        .map((r, i) =>
          r.cloneDy !== undefined ? (
            <div key={i} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden" }}>
              {video({ position: "absolute", left: -r.x, top: -(r.y + r.cloneDy), width: content.w, height: content.h })}
            </div>
          ) : (
            <div key={i} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, background: r.color, borderRadius: 3 }} />
          ),
        )}
    </AbsoluteFill>
  );
};

const PopupWindow: React.FC<{ scene: SceneT; popup: PopupT }> = ({ scene, popup }) => {
  const f = useCurrentFrame();
  const fadeOut = 7;
  if (f < popup.open || f >= popup.close + fadeOut) return null;
  const inP = interpolate(f, [popup.open, popup.open + 9], [0, 1], { ...clamp, easing: ease });
  const outP = interpolate(f, [popup.close, popup.close + fadeOut], [1, 0], clamp);
  const r = popup.rect;
  return (
    <div
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: 12,
        overflow: "hidden",
        background: "#ffffff",
        opacity: Math.min(inP, outP),
        transform: `scale(${0.97 + 0.03 * inP})`,
        boxShadow: "0 0 0 1px rgba(3,8,10,0.10), 0 34px 90px rgba(3,8,10,0.22), 0 10px 28px rgba(3,8,10,0.10)",
      }}
    >
      <TopBar host={popup.host} />
      <div style={{ position: "absolute", left: 0, top: topBar, right: 0, bottom: 0 }}>
        {scene.segments.map((g, i) =>
          g.from + g.dur > popup.open && g.from < popup.close + fadeOut ? (
            <Sequence key={i} from={g.from} durationInFrames={g.dur}>
              <SegmentVideo segment={g} src={staticFile(popup.src)} />
            </Sequence>
          ) : null,
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- cursor (stage coordinates, scales with the camera)
const ARROW = "M0 0 L0 17.6 L4.3 13.5 L7.1 20.1 L9.9 18.9 L7.1 12.5 L12.9 12.5 Z";

const Cursor: React.FC<{ scene: SceneT }> = ({ scene }) => {
  const f = useCurrentFrame();
  const c = scene.cursor;
  if (!c || f >= c.x.length) return null;
  const idx = tl.scenes.indexOf(scene);
  const next = tl.scenes[idx + 1];
  const outF = next ? next.xfadeIn : 0;
  const fade = Math.min(
    scene.xfadeIn ? interpolate(f, [0, scene.xfadeIn], [0, 1], clamp) : 1,
    outF ? interpolate(f, [scene.dur - outF, scene.dur - outF / 2], [1, 0], clamp) : 1,
  );
  const size = tl.layout.cssScale * 1.2;
  return (
    <>
      {scene.clicks
        .filter((k) => f >= k.f && f < k.f + 18)
        .map((k, i) => {
          const u = (f - k.f) / 18;
          const e = 1 - Math.pow(1 - u, 3);
          const rr = 5 + 24 * e;
          return (
            <svg key={i} style={{ position: "absolute", left: k.x - 40, top: k.y - 40, width: 80, height: 80, opacity: fade * (1 - u) }} viewBox="0 0 80 80">
              <circle cx={40} cy={40} r={rr} fill={`rgba(200,255,0,${0.22 * (1 - u)})`} stroke="rgba(74,96,0,0.35)" strokeWidth={4.2 - 2 * e} />
              <circle cx={40} cy={40} r={rr} fill="none" stroke={LIME} strokeWidth={3 - 1.4 * e} />
            </svg>
          );
        })}
      <svg
        style={{
          position: "absolute",
          left: c.x[f] - 2 * size,
          top: c.y[f] - 2 * size,
          width: 18 * size,
          height: 26 * size,
          opacity: c.o[f] * fade,
          transform: `scale(${1 - 0.12 * c.p[f]})`,
          transformOrigin: `${2 * size}px ${2 * size}px`,
          filter: "drop-shadow(0 1.5px 2px rgba(3,8,10,0.28))",
          overflow: "visible",
        }}
        viewBox="-2 -2 18 26"
      >
        <path d={ARROW} fill="#ffffff" stroke={INK} strokeWidth={1.25} strokeLinejoin="round" />
      </svg>
    </>
  );
};

// ---------------------------------------------------------------- overlays
const Chapters: React.FC = () => {
  const f = useCurrentFrame();
  const ch = tl.chapters.find((c) => f >= c.from && f < c.to);
  if (!ch) return null;
  const o = interpolate(f, [ch.from, ch.from + 10, ch.to - 9, ch.to], [0, 1, 1, 0], clamp);
  const dy = interpolate(f, [ch.from, ch.from + 12], [-4, 0], { ...clamp, easing: ease });
  return (
    <div
      style={{
        position: "absolute",
        left: win.x,
        top: 14,
        opacity: o,
        transform: `translateY(${dy}px)`,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 14px 6px 11px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 0 0 1px rgba(3,8,10,0.08), 0 4px 14px rgba(3,8,10,0.06)",
        fontFamily: "PPMori-Semibold",
        fontSize: 15,
        lineHeight: "18px",
        color: INK,
        letterSpacing: "-0.005em",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 7, background: LIME, boxShadow: `0 0 0 1px ${OLIVE}55` }} />
      {ch.text}
    </div>
  );
};

const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const i = tl.captions.findIndex((c) => f >= c.from && f < c.to);
  if (i < 0) return null;
  const c = tl.captions[i];
  const prev = tl.captions[i - 1];
  const next = tl.captions[i + 1];
  const joinedIn = prev && c.from - prev.to <= 3;
  const joinedOut = next && next.from - c.to <= 3;
  const o = Math.min(joinedIn ? 1 : interpolate(f, [c.from, c.from + 5], [0, 1], clamp), joinedOut ? 1 : interpolate(f, [c.to - 5, c.to], [1, 0], clamp));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          maxWidth: 1180,
          padding: "11px 26px 13px",
          borderRadius: 18,
          background: "rgba(3,8,10,0.85)",
          color: "#ffffff",
          fontFamily: "PPMori-Regular",
          fontSize: 30,
          lineHeight: "40px",
          textAlign: "center",
          textWrap: "balance",
          letterSpacing: "-0.003em",
        }}
      >
        {c.text}
      </div>
    </div>
  );
};

const TitleCard: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= tl.title.dur) return null;
  const out = interpolate(f, [tl.title.dur - tl.title.out, tl.title.dur], [1, 0], clamp);
  const a = interpolate(f, [2, 20], [0, 1], { ...clamp, easing: ease });
  const b = interpolate(f, [9, 27], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 10}px)` }}>
        <Wordmark width={300} color={INK} />
      </div>
      <div style={{ marginTop: 34, fontFamily: "PPMori-Book", fontSize: 42, letterSpacing: "-0.015em", color: INK, opacity: b, transform: `translateY(${(1 - b) * 10}px)` }}>
        {tl.title.text}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const f = useCurrentFrame() - tl.end.from;
  if (f < 0 || !tl.end.dur) return null;
  const p = (start: number) => interpolate(f, [start, start + 20], [0, 1], { ...clamp, easing: ease });
  const fadeOut = interpolate(f, [tl.end.dur - 12, tl.end.dur], [1, 0], clamp);
  const rise = (v: number) => ({ opacity: v, transform: `translateY(${(1 - v) * 10}px)` });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div style={rise(p(4))}>
        <Wordmark width={270} color={INK} />
      </div>
      <div style={{ marginTop: 30, fontFamily: "PPMori-Regular", fontSize: 48, letterSpacing: "-0.02em", color: INK, ...rise(p(10)) }}>Always on the best API</div>
      <div style={{ marginTop: 18, fontFamily: "PPMori-Book", fontSize: 26, color: "rgba(3,8,10,0.55)", ...rise(p(16)) }}>tender.heyarca.app</div>
      <div style={{ position: "absolute", bottom: 64, fontFamily: "PPMori-Book", fontSize: 18, letterSpacing: "0.01em", color: "rgba(3,8,10,0.45)", ...rise(p(22)) }}>Built with PayPal</div>
    </AbsoluteFill>
  );
};

// Shape of src/timeline.json, written by scripts/build-timeline.ts and read by the composition.

export type Rect = { x: number; y: number; w: number; h: number };

export type Segment = {
  /** First output frame, relative to the scene. */
  from: number;
  dur: number;
  /** Source frame shown at `from`. */
  srcFrame: number;
  /** Source frames per output frame; 0 freezes on `srcFrame`. */
  rate: number;
  /** Frames of dissolve from the previous segment (0 = hard continuation). */
  fadeIn: number;
};

export type PopupT = {
  src: string;
  /** Output frames (scene-relative) where the popup window is shown. */
  open: number;
  close: number;
  /** Window rect in stage coordinates, including the top bar. */
  rect: Rect;
  host: string;
};

export type SceneT = {
  id: string;
  /** Global start frame and length. */
  from: number;
  dur: number;
  /** Frames this scene dissolves in over the previous one. */
  xfadeIn: number;
  kind: "clip" | "end";
  clip: string | null;
  placeholder: boolean;
  segments: Segment[];
  /**
   * Patches over third-party names (source-time range, content px rect on the main page): a flat fill, or a copy of
   * the same frame `cloneDy` px lower, which keeps any overlay or dimming identical.
   */
  redact: { from: number; to: number; x: number; y: number; w: number; h: number; color?: string; cloneDy?: number }[];
  popups: PopupT[];
  /** Per-frame cursor in stage coordinates (scene-relative frames); null when the clip has no pointer events. */
  cursor: { x: number[]; y: number[]; o: number[]; p: number[] } | null;
  /** Click rings: scene-relative frame + stage coordinates. */
  clicks: { f: number; x: number; y: number }[];
};

export type Timeline = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  layout: {
    window: Rect;
    topBar: number;
    content: Rect;
    /** Output px per CSS px at camera zoom 1. */
    cssScale: number;
    radius: number;
  };
  title: { dur: number; out: number; text: string };
  end: { from: number; dur: number };
  scenes: SceneT[];
  /** Global per-frame camera: zoom and the stage point placed at frame center. */
  camera: { z: number[]; x: number[]; y: number[] };
  chapters: { text: string; from: number; to: number }[];
  captions: { text: string; from: number; to: number }[];
  vo: { src: string; from: number; trimBefore: number; dur: number }[];
  music: { src: string; volume: number[] } | null;
};

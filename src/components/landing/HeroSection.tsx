import { ArrowDown, ArrowUpRight } from "lucide-react";
import { ButtonLink } from "./LandingButton";
import { DEMO_HREF } from "./LandingChrome";
import { HeroMedia } from "./LandingMedia";
import { landingStyles as styles } from "./styles";

/* Track field: 1600 × 260 px, centred on the page, unscaled so the vehicle's motion path matches. */
const FIELD_WIDTH = 1600;
const FIELD_HEIGHT = 260;
/** Lane ends start just above the top edge. */
const ENTRY_Y = -16;

interface Lane {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Distance between the lane's two lines. */
  gap: number;
  /** x positions of the direction marks. */
  marks: number[];
}

/* Huge, shallow lower arcs of ellipses centred above the field: they arc in from the top
   edge and converge above the headline. The last lane is the winning lane. */
const LANES: Lane[] = [
  { cx: 460, cy: -430, rx: 840, ry: 596, gap: 7, marks: [150, 700] },
  { cx: 1170, cy: -400, rx: 800, ry: 576, gap: 7, marks: [930, 1450] },
  { cx: 800, cy: -620, rx: 1120, ry: 799, gap: 9, marks: [360, 1240] },
];
const WINNING_LANE = LANES[LANES.length - 1]!;

const round = (value: number) => Math.round(value * 10) / 10;

/** Point on the lower half of the ellipse at parameter t ∈ (0, π). */
function pointAt(lane: Lane, t: number, inset = 0) {
  return { x: lane.cx + (lane.rx + inset) * Math.cos(t), y: lane.cy + (lane.ry + inset) * Math.sin(t) };
}

/** Lower arc between the two points where the ellipse crosses ENTRY_Y, left to right. */
function arcPath(lane: Lane, inset = 0) {
  const rx = lane.rx + inset;
  const ry = lane.ry + inset;
  const t = Math.asin(Math.min(1, (ENTRY_Y - lane.cy) / ry));
  const start = { x: lane.cx - rx * Math.cos(t), y: lane.cy + ry * Math.sin(t) };
  const end = { x: lane.cx + rx * Math.cos(t), y: start.y };
  return `M${round(start.x)} ${round(start.y)}A${rx} ${ry} 0 0 0 ${round(end.x)} ${round(end.y)}`;
}

/** Chevron centred between the lane's lines at x, pointing in the direction of travel. */
function markTransform(lane: Lane, x: number) {
  const inset = lane.gap / 2;
  const t = Math.acos(Math.max(-1, Math.min(1, (x - lane.cx) / (lane.rx + inset))));
  const point = pointAt(lane, t, inset);
  const angle = (Math.atan2(-(lane.ry + inset) * Math.cos(t), (lane.rx + inset) * Math.sin(t)) * 180) / Math.PI;
  return `translate(${round(point.x)} ${round(point.y)}) rotate(${round(angle)})`;
}

const VEHICLE_PATH = arcPath(WINNING_LANE, WINNING_LANE.gap / 2);

function HeroTracks() {
  return (
    <div className={styles.heroTracks} aria-hidden="true">
      <svg
        className={styles.heroTracksSvg}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
        fill="none"
        focusable="false"
      >
        {LANES.map((lane, index) => (
          <g key={index} className={lane === WINNING_LANE ? `${styles.heroLane} ${styles.heroLaneWin}` : styles.heroLane}>
            <path d={arcPath(lane)} />
            <path d={arcPath(lane, lane.gap)} />
            {lane.marks.map((x) => (
              <path key={x} className={styles.heroLaneMark} d="M-2.5 -3 L1.5 0 L-2.5 3" transform={markTransform(lane, x)} />
            ))}
          </g>
        ))}
      </svg>
      <span className={styles.heroVehicle} style={{ offsetPath: `path("${VEHICLE_PATH}")` }} />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <HeroTracks />
      <div className={`${styles.container} ${styles.heroIntro}`}>
        <h1 id="hero-title" className={styles.heroTitle}>
          <span className={styles.heroTitleLine}>Always on the</span>{" "}
          <span className={styles.heroTitleLine}>best API.</span>
        </h1>
        <p className={styles.heroLead}>
          If an API breaks, Tender switches. If a better one shows up, Tender switches. Your app never notices.
        </p>
        <div className={styles.heroActions}>
          <ButtonLink href={DEMO_HREF} size="lg" fluid icon={<ArrowUpRight size={20} />}>
            Try Tender
          </ButtonLink>
          <ButtonLink href="/demo" variant="secondary" size="lg" fluid icon={<ArrowUpRight size={20} />}>
            Watch video
          </ButtonLink>
        </div>
        <a href="#how-it-works" className={styles.heroHowLink}>
          See how it works <ArrowDown size={16} aria-hidden />
        </a>
      </div>
      <div className={`${styles.container} ${styles.heroMediaWrap}`}>
        <HeroMedia />
      </div>
    </section>
  );
}

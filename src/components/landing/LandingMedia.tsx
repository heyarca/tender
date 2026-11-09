"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "./LandingButton";
import { createSceneState, HERO_PROVIDER_IDS, sceneReducer, selectScene } from "./demo-model";
import { RouteToast, routeSwitchOf, RoutingCard } from "./ProviderComparison";
import { landingStyles as styles } from "./styles";

/** Delay before the hero's provider slows down and Tender switches. */
export const HERO_SWITCH_DELAY_MS = 3_500;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

/** Without the file, the frame's neutral background shows instead of a broken image. */
function hidePoster(image: HTMLImageElement) {
  image.style.visibility = "hidden";
}

/**
 * Aerial traffic film. The poster loads first; the video plays only when motion is
 * allowed and the connection does not ask to save data, and pauses off screen.
 */
export function TrafficFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    // A poster that failed before hydration never reaches onError.
    const image = poster.current;
    if (image?.complete && image.naturalWidth === 0) hidePoster(image);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const motion = window.matchMedia(REDUCED_MOTION);
    let visible = true;
    const sync = () => {
      if (visible && !userPaused.current && !motion.matches && !saveData()) void element.play().catch(() => {});
      else element.pause();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            sync();
          });
    observer?.observe(element);
    sync();
    motion.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      observer?.disconnect();
      element.pause();
    };
  }, []);

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) {
      userPaused.current = false;
      void element.play().catch(() => {});
    } else {
      userPaused.current = true;
      element.pause();
    }
  };

  return (
    <>
      <picture>
        <source srcSet="/landing/hero-traffic.avif" type="image/avif" />
        <img
          ref={poster}
          className={styles.mediaFill}
          src="/landing/hero-traffic.jpg"
          alt=""
          width={2560}
          height={1280}
          fetchPriority="high"
          decoding="async"
          onError={(event) => hidePoster(event.currentTarget)}
        />
      </picture>
      {available ? (
        <video
          ref={video}
          className={`${styles.mediaFill} ${styles.heroVideo}`}
          data-started={started || undefined}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => {
            setPlaying(true);
            setStarted(true);
          }}
          onPause={() => setPlaying(false)}
        >
          <source src="/landing/hero-traffic.webm" type="video/webm" />
          <source src="/landing/hero-traffic.mp4" type="video/mp4" onError={() => setAvailable(false)} />
        </video>
      ) : null}
      {available ? (
        <Button
          variant="glass"
          className={styles.heroFilmToggle}
          icon={playing ? <Pause size={20} /> : <Play size={20} />}
          iconPosition="start"
          onClick={toggle}
        >
          {playing ? "Pause video" : "Play video"}
        </Button>
      ) : null}
    </>
  );
}

/**
 * Hero media: the traffic film with the routing card on top. The card runs the
 * product engine in an isolated scene; once, a few seconds after mount, THE ZONE BIO
 * slows down and the engine fails over (skipped under reduced motion).
 */
export function HeroMedia() {
  const [scene, dispatch] = useReducer(sceneReducer, undefined, createSceneState);
  const view = selectScene(scene);

  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    const timer = window.setTimeout(() => dispatch({ type: "latency" }), HERO_SWITCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.mediaFrame} ${styles.heroMedia}`}>
      <TrafficFilm />
      <div className={styles.heroStage}>
        <RouteToast event={routeSwitchOf(view)} />
        <RoutingCard view={view} ids={HERO_PROVIDER_IDS} />
      </div>
    </div>
  );
}

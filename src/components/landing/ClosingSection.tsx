import { ArrowUpRight, Sparkles } from "lucide-react";
import { ButtonLink } from "./LandingButton";
import { SectionHeader } from "./SectionHeader";
import { landingStyles as styles } from "./styles";

/** Pale double tracks that echo the hero lanes; static and decorative. */
function ClosingTracks() {
  return (
    <svg className={styles.closingTracks} viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className={styles.closingTrackLines} fill="none" stroke="currentColor">
        <path d="M-160 520C120 120 520 40 760 40S1340 150 1620 470" />
        <path d="M-160 527C120 127 520 47 760 47S1340 157 1620 477" />
        <path d="M-40 560C260 230 560 150 800 152S1260 260 1520 560" />
        <path d="M-40 567C260 237 560 157 800 159S1260 267 1520 567" />
      </g>
      <g className={styles.closingTrackMarks} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-2.5-3 1.5 0-2.5 3" transform="translate(265 156) rotate(-26)" />
        <path d="M-2.5-3 1.5 0-2.5 3" transform="translate(1220 160) rotate(27)" />
        <path d="M-2.5-3 1.5 0-2.5 3" transform="translate(1238 301) rotate(35)" />
      </g>
      <rect className={styles.closingTrackVehicle} x="-9" y="-3.5" width="18" height="7" rx="3.5" transform="translate(272 302) rotate(-31)" />
    </svg>
  );
}

/** Manifesto: two lines in the section-heading style, right above the closing call to action. */
export function ManifestoSection() {
  return (
    <section className={styles.section} aria-labelledby="manifesto-title">
      <div className={styles.container}>
        <SectionHeader
          titleId="manifesto-title"
          title={
            <>
              APIs break. Prices change. Better ones appear.
              <br />
              Tender keeps every call on the best one.
            </>
          }
        />
      </div>
    </section>
  );
}

/** Closing call to action: centered, generous whitespace, one primary button. */
export function ClosingSection() {
  return (
    <section className={`${styles.section} ${styles.closing}`} aria-labelledby="closing-title">
      <ClosingTracks />
      <div className={`${styles.container} ${styles.closingInner}`}>
        <h2 id="closing-title" className={styles.closingTitle}>
          <span>Find a better provider</span> <span>for your next request.</span>
        </h2>
        <p className={styles.closingBody}>
          Pick one of Tender’s markets or let your AI agent create a new one. Add funds with PayPal, or let Ask Tender set your
          requirements and pay for your next request.
        </p>
        <div className={styles.closingActions}>
          <ButtonLink href="/markets" variant="primary" size="lg" icon={<ArrowUpRight />}>
            Try Tender
          </ButtonLink>
          <ButtonLink href="/markets/sf-weather?ask=1" variant="secondary" size="lg" icon={<Sparkles size={20} />} iconPosition="start">
            Try Ask Tender
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

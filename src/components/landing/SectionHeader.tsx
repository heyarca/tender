import type { ReactNode } from "react";
import { landingStyles as styles } from "./styles";

/** Section heading: no eyebrow, a two-line title on the left and the lead on the right. */
export function SectionHeader({ titleId, title, lead }: { titleId: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <header className={styles.sectionHeader}>
      <h2 id={titleId} className={styles.sectionTitle}>{title}</h2>
      {lead ? <p className={styles.sectionLead}>{lead}</p> : null}
    </header>
  );
}

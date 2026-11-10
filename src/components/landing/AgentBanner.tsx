"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy } from "lucide-react";
import { landingStyles as styles } from "./styles";

const COMMAND = "npx @heyarca/tender@latest";

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className={styles.agentCopy} onClick={copy} aria-label={copied ? "Command copied" : "Copy command"}>
      {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      <span className={styles.srOnly} aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

/** Small banner under the hero: let an agent move API integrations to Tender. */
export function AgentBanner() {
  return (
    <section className={styles.agentSection} aria-labelledby="agent-banner-title">
      <div className={styles.container}>
        <div className={styles.agentBanner}>
          <div className={styles.agentCopyBlock}>
            <span className={styles.agentIcon} aria-hidden="true"><Bot size={22} strokeWidth={1.75} /></span>
            <div>
              <h2 id="agent-banner-title" className={styles.agentTitle}>Let your agent buy and sell API access.</h2>
              <p className={styles.agentText}>Let your agent move your API integrations to Tender. It pays for each call with credits you add with PayPal.</p>
            </div>
          </div>
          <div className={styles.agentCommandBlock}>
            <div className={styles.agentCommand}>
              <code><span className={styles.agentPrompt} aria-hidden="true">$</span>{COMMAND}</code>
              <CopyCommand />
            </div>
            <p className={styles.agentCaption}>Run in your project directory.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

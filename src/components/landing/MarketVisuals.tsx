import { Cloud, Wind, Gauge, ArrowUpRight } from "lucide-react";
import { landingStyles as styles } from "./styles";

export function BitcoinChart({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.chartCompact : styles.chart}>
      <svg
        viewBox="0 0 480 150"
        role="img"
        aria-label="Illustrative Bitcoin price history, not a live quote"
        preserveAspectRatio="none"
      >
        <path className={styles.chartGrid} d="M0 25H480M0 75H480M0 125H480" />
        <path
          className={styles.chartArea}
          d="M0 113L13 108L22 116L35 103L46 107L59 85L70 96L82 88L94 98L105 78L117 82L130 55L142 66L154 60L167 75L179 67L191 78L205 64L217 70L230 56L242 61L254 42L267 53L279 45L291 55L304 49L316 57L329 35L340 42L353 25L365 34L377 23L389 36L401 28L414 39L426 20L438 30L450 17L463 23L480 13V150H0Z"
        />
        <path
          className={styles.chartLine}
          d="M0 113L13 108L22 116L35 103L46 107L59 85L70 96L82 88L94 98L105 78L117 82L130 55L142 66L154 60L167 75L179 67L191 78L205 64L217 70L230 56L242 61L254 42L267 53L279 45L291 55L304 49L316 57L329 35L340 42L353 25L365 34L377 23L389 36L401 28L414 39L426 20L438 30L450 17L463 23L480 13"
        />
      </svg>
      {!compact && (
        <div className={styles.chartAxis}>
          <span>Earlier</span>
          <span>Sample history</span>
          <span>Latest</span>
        </div>
      )}
    </div>
  );
}

export function BitcoinMarketVisual() {
  return (
    <div className={styles.marketVisual}>
      <div className={styles.visualLabel}>
        <span>
          <span className={styles.bitcoinSymbol}>₿</span> BTC / USD
        </span>
        <span>Sample data</span>
      </div>
      <div className={styles.bitcoinValue}>
        $75,230<span>.75</span>
        <ArrowUpRight size={23} aria-hidden="true" />
      </div>
      <BitcoinChart />
    </div>
  );
}

export function WeatherMarketVisual() {
  return (
    <div className={styles.marketVisual}>
      <div className={styles.visualLabel}>
        <span>San Francisco, CA</span>
        <span>Sample data</span>
      </div>
      <div className={styles.weatherReading}>
        <div>
          <div className={styles.temperature}>
            61<span>°F</span>
          </div>
          <span>Overcast</span>
        </div>
        <div className={styles.weatherCloud}>
          <Cloud strokeWidth={1} aria-hidden="true" />
        </div>
      </div>
      <div className={styles.weatherMeta}>
        <span>
          <Wind size={16} aria-hidden="true" /> 9 mph W
        </span>
        <span>
          <Gauge size={16} aria-hidden="true" /> 1018 hPa
        </span>
      </div>
    </div>
  );
}

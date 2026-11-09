import { toBitcoinQuote, toPricePoints, toResultRequest, toWeatherReading, vizProvidersOf } from "@/components/market/page/result-mapping";
import { BitcoinResult, WeatherResult } from "@/components/result";
import { getInitialMarketView } from "@/lib/tender";
import { landingStyles as styles } from "./styles";

/**
 * Market card figures. Each one renders the product's own result component from the
 * engine's initial market view (seeded series, newest served request), so the cards
 * show exactly what a market page shows before the first run.
 */
export function BitcoinMarketVisual() {
  const view = getInitialMarketView("btc-usd");
  return (
    <div className={`${styles.marketStage} ${styles.marketStageGrid}`}>
      <div className={`${styles.marketWindow} ${styles.productUi}`}>
        <BitcoinResult
          quote={toBitcoinQuote(view.lastServed)}
          request={toResultRequest(view.lastResult, view.providersById)}
          points={toPricePoints(view.series, view.recentResults)}
          providers={vizProvidersOf(view.definition)}
          timeZone={view.definition.timeZone}
          timeZoneLabel={view.definition.timeZoneLabel}
          chartHeight={150}
        />
      </div>
    </div>
  );
}

export function WeatherMarketVisual() {
  const view = getInitialMarketView("sf-weather");
  return (
    <div className={`${styles.marketStage} ${styles.marketStagePhoto}`}>
      <picture className={styles.marketPhoto}>
        <source srcSet="/landing/weather-sf.avif" type="image/avif" />
        <img src="/landing/weather-sf.jpg" width={1600} height={1200} alt="Fog rolling over San Francisco" loading="lazy" decoding="async" />
      </picture>
      <div className={`${styles.marketWindow} ${styles.marketWindowFloat} ${styles.productUi}`}>
        <WeatherResult
          reading={toWeatherReading(view.lastServed)}
          request={toResultRequest(view.lastResult, view.providersById)}
          timeZone={view.definition.timeZone}
          timeZoneLabel={view.definition.timeZoneLabel}
        />
      </div>
    </div>
  );
}

import { toBitcoinQuote, toPricePoints, toResultRequest, toWeatherReading, vizProvidersOf } from "@/components/market/page/result-mapping";
import { BitcoinResult, WeatherResult } from "@/components/result";
import { selectMarketView } from "@/lib/tender";
import { createSceneState } from "./demo-model";

const scene = createSceneState();
import { landingStyles as styles } from "./styles";

/**
 * Product previews show response-time age and elapsed chart time. They do not
 * present the instructional scene as a current upstream observation.
 */
export function BitcoinMarketVisual() {
  const view = selectMarketView(scene.markets["btc-usd"]);
  return (
    <div className={`${styles.marketStage} ${styles.marketStageGrid}`}>
      <div className={`${styles.marketWindow} ${styles.productUi}`}>
        <BitcoinResult
          preview
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
  const view = selectMarketView(scene.markets["sf-weather"]);
  return (
    <div className={`${styles.marketStage} ${styles.marketStagePhoto}`}>
      <picture className={styles.marketPhoto}>
        <source srcSet="/landing/weather-sf.avif" type="image/avif" />
        <img src="/landing/weather-sf.jpg" width={1600} height={1200} alt="Fog rolling over San Francisco" loading="lazy" decoding="async" />
      </picture>
      <div className={`${styles.marketWindow} ${styles.marketWindowFloat} ${styles.productUi}`}>
        <WeatherResult
          preview
          reading={toWeatherReading(view.lastServed)}
          request={toResultRequest(view.lastResult, view.providersById)}
          timeZone={view.definition.timeZone}
          timeZoneLabel={view.definition.timeZoneLabel}
        />
      </div>
    </div>
  );
}

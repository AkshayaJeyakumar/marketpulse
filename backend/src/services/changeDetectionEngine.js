/**
 * Change Detection Engine
 *
 * Deterministic and explainable.
 *
 * The engine compares:
 *
 *     previous user snapshot → current market state
 *
 * It produces three independent signals:
 *
 *     1. Price movement
 *     2. Trading-volume change
 *     3. Intraday volatility
 *
 * The signals are deliberately kept independent so that
 * the explanation layer can tell the user WHICH type of
 * market activity was unusual.
 */

export function computeSignals(previous, current) {
  const priceSignal =
    computePriceSignal(
      previous,
      current
    );

  const volumeSignal =
    computeVolumeSignal(
      previous,
      current
    );

  const volatilitySignal =
    computeVolatilitySignal(
      current
    );

  return {
    priceSignal,
    volumeSignal,
    volatilitySignal,
  };
}


/**
 * PRICE SIGNAL
 *
 * Measures price movement since the user's
 * previous snapshot.
 *
 * 0% movement  = 0
 * 5% movement  = 100
 */
function computePriceSignal(
  previous,
  current
) {
  if (
    !Number.isFinite(previous?.price) ||
    !Number.isFinite(current?.price) ||
    previous.price <= 0
  ) {
    return 0;
  }

  const pctChange =
    Math.abs(
      ((current.price -
        previous.price) /
        previous.price) *
        100
    );

  return clamp(
    (pctChange / 5) * 100,
    0,
    100
  );
}


/**
 * VOLUME SIGNAL
 *
 * Measures how much trading volume changed
 * since the user's previous snapshot.
 *
 * Unlike the old implementation, BOTH increases
 * and decreases are detected.
 *
 * Same volume       = 0
 * 50% change        = 25
 * 100% change       = 50
 * 200% change       = 100
 */
function computeVolumeSignal(
  previous,
  current
) {
  if (
    !Number.isFinite(previous?.volume) ||
    !Number.isFinite(current?.volume) ||
    previous.volume <= 0
  ) {
    return 0;
  }

  const volumeChange =
    Math.abs(
      current.volume -
        previous.volume
    ) /
    previous.volume;

  return clamp(
    (volumeChange / 2) * 100,
    0,
    100
  );
}


/**
 * VOLATILITY SIGNAL
 *
 * Measures the current intraday trading range.
 *
 * Unlike the previous implementation, volatility
 * is intentionally given less weight so that a
 * normal intraday range does not dominate the
 * explanation.
 *
 * 0% range   = 0
 * 6%+ range  = 100
 */
function computeVolatilitySignal(
  current
) {
  if (
    !Number.isFinite(
      current?.dayHigh
    ) ||
    !Number.isFinite(
      current?.dayLow
    ) ||
    !Number.isFinite(
      current?.prevClose
    ) ||
    current.prevClose <= 0
  ) {
    return 0;
  }

  const range =
    Math.max(
      0,
      current.dayHigh -
        current.dayLow
    );

  const rangePct =
    (range /
      current.prevClose) *
    100;

  return clamp(
    (rangePct / 6) * 100,
    0,
    100
  );
}


/**
 * Utility
 */
function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}
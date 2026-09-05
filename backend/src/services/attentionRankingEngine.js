/**
 * Attention Ranking Engine.
 *
 * Combines the signals from the Change Detection Engine
 * into a single Attention Score and maps that score
 * to a product tier.
 *
 * These thresholds are product decisions.
 * They are NOT financial recommendations,
 * predictions, or trading signals.
 */

export const DEFAULT_THRESHOLDS = {
  priceWeight: 0.5,
  volumeWeight: 0.3,
  volatilityWeight: 0.2,

  /*
   * Product tiers
   *
   * 60+  = Significant
   * 25+  = Worth watching
   * below 25 = Normal
   */
  significantMin: 60,
  worthWatchingMin: 25,
};


/**
 * Calculate an attention score for a stock.
 *
 * @param {{
 *   priceSignal: number,
 *   volumeSignal: number,
 *   volatilitySignal: number
 * }} signals
 *
 * @param {typeof DEFAULT_THRESHOLDS} thresholds
 *
 * @returns {{
 *   attentionScore: number,
 *   tier: 'significant'|'worth_watching'|'normal'
 * }}
 */
export function rankAttention(
  signals,
  thresholds = DEFAULT_THRESHOLDS
) {
  const priceSignal =
    Number(signals?.priceSignal) || 0;

  const volumeSignal =
    Number(signals?.volumeSignal) || 0;

  const volatilitySignal =
    Number(signals?.volatilitySignal) || 0;


  /*
   * Weighted attention score.
   *
   * Price movement is the strongest factor,
   * followed by trading activity and volatility.
   */
  const attentionScore =
    priceSignal *
      thresholds.priceWeight +
    volumeSignal *
      thresholds.volumeWeight +
    volatilitySignal *
      thresholds.volatilityWeight;


  /*
   * Keep the final score between 0 and 100.
   */
  const rounded = Math.min(
    100,
    Math.max(
      0,
      Math.round(attentionScore)
    )
  );


  /*
   * Convert score into a product tier.
   */
  let tier = 'normal';

  if (
    rounded >=
    thresholds.significantMin
  ) {
    tier = 'significant';
  } else if (
    rounded >=
    thresholds.worthWatchingMin
  ) {
    tier = 'worth_watching';
  }


  return {
    attentionScore: rounded,
    tier,
  };
}
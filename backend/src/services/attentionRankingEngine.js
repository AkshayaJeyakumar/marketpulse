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
 * @param {number|object} input - Anomaly score (0-100) or metrics object
 * @param {typeof DEFAULT_THRESHOLDS} thresholds
 *
 * @returns {{
 *   attentionScore: number,
 *   tier: 'significant'|'worth_watching'|'normal'
 * }}
 */
export function rankAttention(
  input,
  thresholds = DEFAULT_THRESHOLDS
) {
  let rawScore = 0;

  if (typeof input === 'number') {
    rawScore = input;
  } else if (input && typeof input.anomalyScore === 'number') {
    rawScore = input.anomalyScore;
  } else if (input && typeof input === 'object') {
    const priceSignal = Number(input.priceSignal) || 0;
    const volumeSignal = Number(input.volumeSignal) || 0;
    const volatilitySignal = Number(input.volatilitySignal) || 0;

    rawScore =
      priceSignal * thresholds.priceWeight +
      volumeSignal * thresholds.volumeWeight +
      volatilitySignal * thresholds.volatilityWeight;
  }

  /*
   * Keep the final score between 0 and 100.
   */
  const rounded = Math.min(
    100,
    Math.max(0, Math.round(rawScore))
  );

  /*
   * Convert score into a product tier.
   * - significant: anomalyScore >= 60
   * - worth_watching: anomalyScore >= 25 and < 60
   * - normal: anomalyScore < 25
   */
  let tier = 'normal';

  if (rounded >= thresholds.significantMin) {
    tier = 'significant';
  } else if (rounded >= thresholds.worthWatchingMin) {
    tier = 'worth_watching';
  }

  return {
    attentionScore: rounded,
    tier,
  };
}
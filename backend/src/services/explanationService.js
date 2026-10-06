/**
 * Explanation Service
 *
 * Converts computed market signals into plain-language explanations.
 *
 * Important:
 * - Deterministic and rule-based.
 * - Never gives investment advice.
 * - Never claims that a signal proves the cause of a price movement.
 */

export function explainSignals(
  { priceSignal, volumeSignal, volatilitySignal },
  current
) {
  const reasons = [];

  const safePriceSignal = Number(priceSignal) || 0;
  const safeVolumeSignal = Number(volumeSignal) || 0;
  const safeVolatilitySignal =
    Number(volatilitySignal) || 0;

  /*
   * PRICE
   */
  if (safePriceSignal >= 60) {
    reasons.push(
      current?.direction === 'down'
        ? 'Price moved down more than usual since your last view.'
        : 'Price moved up more than usual since your last view.'
    );
  } else if (safePriceSignal >= 30) {
    reasons.push(
      'Price shifted a bit more than typical since your last view.'
    );
  }

  /*
   * VOLUME
   */
  if (safeVolumeSignal >= 60) {
    reasons.push(
      'Trading volume is well above its recent baseline.'
    );
  } else if (safeVolumeSignal >= 30) {
    reasons.push(
      'Trading volume is somewhat higher than usual.'
    );
  }

  /*
   * VOLATILITY
   */
  if (safeVolatilitySignal >= 60) {
    reasons.push(
      "Today's price range is unusually wide."
    );
  } else if (safeVolatilitySignal >= 30) {
    reasons.push(
      "Today's price range is a little wider than usual."
    );
  }

  /*
   * FALLBACK
   */
  if (reasons.length === 0) {
    reasons.push(
      'No unusual activity detected since your last view.'
    );
  }

  return reasons;
}


/**
 * Creates one concise explanation describing why the stock
 * received its attention score.
 *
 * This does NOT attempt to determine the real-world cause
 * of the movement.
 */
export function explainAttention(
  {
    priceSignal,
    volumeSignal,
    volatilitySignal,
  },
  attentionScore
) {
  const signals = [];

  if (Number(priceSignal) >= 30) {
    signals.push('price movement');
  }

  if (Number(volumeSignal) >= 30) {
    signals.push('trading activity');
  }

  if (Number(volatilitySignal) >= 30) {
    signals.push('price range');
  }

  if (signals.length === 0) {
    return 'Market activity remains within the normal range.';
  }

  if (signals.length === 1) {
    return `MarketPulse flagged this because ${signals[0]} was more unusual than its baseline.`;
  }

  if (signals.length === 2) {
    return `MarketPulse flagged this because ${signals[0]} and ${signals[1]} were more unusual than their baselines.`;
  }

  return 'MarketPulse flagged this because price movement, trading activity, and price range were all more unusual than their baselines.';
}


/**
 * Returns a structured explanation object for the UI.
 *
 * @param {string|object} summaryInput - summaryText from anomaly detection engine or legacy signals
 * @param {object} [current] - current stock data object
 * @param {number} [attentionScore] - attention/anomaly score
 */
export function buildExplanation(
  summaryInput,
  current,
  attentionScore
) {
  let summaryText = '';

  if (typeof summaryInput === 'string') {
    summaryText = summaryInput;
  } else if (summaryInput && typeof summaryInput.summaryText === 'string') {
    summaryText = summaryInput.summaryText;
  } else if (summaryInput && typeof summaryInput === 'object') {
    summaryText = explainAttention(summaryInput, attentionScore);
  } else {
    summaryText = 'Observation of market activity reflects normal activity consistent with standard historical parameters.';
  }

  const reasons = typeof summaryInput === 'string'
    ? [summaryText]
    : explainSignals(summaryInput || {}, current);

  return {
    reasons,
    summary: summaryText,
    disclaimer:
      'This is an observation of market activity, not investment advice or a prediction.',
  };
}
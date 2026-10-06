/**
 * Anomaly Detection Engine
 *
 * Deterministic rule engine for evaluating statistical stock metrics,
 * detecting market anomalies (including Silent Signal), computing composite
 * 0-100 Anomaly Scores, and generating compliant professional explanations.
 *
 * PURE FUNCTIONAL MODULE - NO SIDE EFFECTS, NO EXTERNAL DEPENDENCIES.
 */

// List of strictly prohibited words/phrases (case-insensitive check)
export const PROHIBITED_WORDS = [
  'fake volume',
  'fraud',
  'manipulation',
  'insider',
  'pump',
  'dump',
  'crash',
];

/**
 * Helper to clamp a number between min and max bounds.
 */
function clamp(val, min, max) {
  const num = Number(val) || 0;
  return Math.min(Math.max(num, min), max);
}

/**
 * 1. Evaluate Anomaly Flags with Market Regime Adaptation
 *
 * Regime Threshold Adaptation:
 * - BEAR: Volume threshold = 2.5, Price Z-score threshold = 3.0 (higher stringency)
 * - BULL: Volume threshold = 1.8, Price Z-score threshold = 2.0 (lower stringency)
 * - SIDEWAYS / Default: Volume threshold = 2.0 (or 3.0), Price Z-score threshold = 2.5
 */
export function evaluateFlags(metrics = {}, marketRegime = 'SIDEWAYS') {
  const returnZ = Number(metrics.returnZScore) || 0;
  const volumeZ = Number(metrics.volumeZScore) || 0;
  const volumeRatio = Number(metrics.volumeRatio) || 0;
  const volatilityZ = Number(metrics.volatilityZScore) || 0;
  const latestReturn = Number(metrics.latestReturn) || 0;

  let priceZThreshold = 2.5;
  let volumeZThreshold = 3.0;
  let volumeRatioThreshold = 2.0;

  if (marketRegime === 'BEAR') {
    priceZThreshold = 3.0;
    volumeZThreshold = 2.5;
    volumeRatioThreshold = 2.0;
  } else if (marketRegime === 'BULL') {
    priceZThreshold = 2.0;
    volumeZThreshold = 1.8;
    volumeRatioThreshold = 1.8;
  }

  const isUnusualPrice = Math.abs(returnZ) >= priceZThreshold;
  const isUnusualVolume = volumeZ >= volumeZThreshold;
  const isVolumeSpike = volumeRatio >= volumeRatioThreshold;
  const isUnusualVolatility = volatilityZ >= 2.5;
  const isSilentSignal = volumeRatio >= volumeRatioThreshold && Math.abs(latestReturn) < 0.005;

  const flags = [];
  if (isUnusualPrice) flags.push('Unusual Price Movement');
  if (isUnusualVolume) flags.push('Unusual Volume');
  if (isVolumeSpike) flags.push('Volume Spike');
  if (isUnusualVolatility) flags.push('Unusual Volatility');
  if (isSilentSignal) flags.push('Silent Signal');

  return {
    isUnusualPrice,
    isUnusualVolume,
    isVolumeSpike,
    isUnusualVolatility,
    isSilentSignal,
    flags,
    marketRegime,
  };
}

/**
 * 2. Calculate Composite Anomaly Score (0 to 100)
 */
export function calculateAnomalyScore(metrics = {}, isSilentSignal = false) {
  const returnZ = Math.abs(Number(metrics.returnZScore) || 0);
  const volumeZ = Math.abs(Number(metrics.volumeZScore) || 0);
  const volatilityZ = Math.abs(Number(metrics.volatilityZScore) || 0);

  const rawBaseScore = (returnZ * 18) + (volumeZ * 12) + (volatilityZ * 10);
  const baseScore = clamp(rawBaseScore, 0, 80);
  const silentBonus = isSilentSignal ? 20 : 0;

  const finalScore = Math.round(baseScore + silentBonus);
  return clamp(finalScore, 0, 100);
}

/**
 * 3. Classify Anomaly Status
 */
export function classifyAnomalyStatus(anomalyScore, isUnusualPrice, isUnusualVolume, isSilentSignal) {
  if (anomalyScore >= 75 || (isUnusualPrice && isUnusualVolume)) {
    return 'Critical Anomaly';
  }
  if (anomalyScore >= 50 || isSilentSignal) {
    return 'Elevated Activity';
  }
  return 'Normal Activity';
}

/**
 * 4. Generate Professional Explanation Text (Granular Explainability Layer)
 */
export function generateSummaryText(metrics = {}, flagState = {}) {
  const observations = [];

  const returnZ = Math.abs(Number(metrics.returnZScore) || 0);
  const volumeZ = Math.abs(Number(metrics.volumeZScore) || 0);
  const volumeRatio = Number(metrics.volumeRatio) || 1;
  const volatilityZ = Math.abs(Number(metrics.volatilityZScore) || 0);

  if (returnZ >= 2.5) {
    observations.push(`price movement is statistically significant at ${returnZ.toFixed(2)} standard deviations from the mean`);
  } else if (returnZ >= 1.5) {
    observations.push(`price movement is elevated at ${returnZ.toFixed(2)} standard deviations from the baseline`);
  } else if (returnZ >= 1.0) {
    observations.push(`price is showing moderate deviation (${returnZ.toFixed(2)}σ) from recent trends`);
  } else {
    observations.push(`price movement is minimal (${returnZ.toFixed(2)}σ deviation)`);
  }

  if (volumeRatio >= 2.0) {
    observations.push(`trading volume is surging at ${volumeRatio.toFixed(1)}x the 20-day average`);
  } else if (volumeRatio >= 1.5) {
    observations.push(`trading volume is elevated at ${volumeRatio.toFixed(1)}x the baseline`);
  } else if (volumeRatio >= 1.2) {
    observations.push(`trading volume is slightly above average (${volumeRatio.toFixed(1)}x)`);
  } else {
    observations.push(`trading volume is near baseline levels (${volumeRatio.toFixed(1)}x)`);
  }

  if (volatilityZ >= 2.0) {
    observations.push(`daily volatility is unusually high (${volatilityZ.toFixed(2)}σ)`);
  } else if (volatilityZ >= 1.5) {
    observations.push(`volatility is trending above historical norms (${volatilityZ.toFixed(2)}σ)`);
  } else {
    observations.push(`volatility remains within normal parameters (${volatilityZ.toFixed(2)}σ)`);
  }

  let summary = 'Observation of market activity: ';

  if (flagState.isSilentSignal) {
    summary = 'Observation of market activity indicates price-volume divergence. Silent Signal detected: High volume activity accompanied by minimal price movement, requiring investigation.';
  } else {
    summary += observations.join('; ') + '.';
  }

  const lowerSummary = summary.toLowerCase();
  for (const word of PROHIBITED_WORDS) {
    if (lowerSummary.includes(word)) {
      throw new Error(`Compliance Violation: Prohibited word "${word}" found in summary text.`);
    }
  }

  return summary;
}

/**
 * 5. Main Entrypoint: Evaluate Anomalies
 *
 * Input: StockStatisticalMetrics object & optional marketRegime string.
 * Output: Strictly typed AnomalyDetectionResult object.
 */
export function evaluateAnomalies(metrics = {}, marketRegime = 'SIDEWAYS') {
  const flagState = evaluateFlags(metrics, marketRegime);
  const anomalyScore = calculateAnomalyScore(metrics, flagState.isSilentSignal);
  const anomalyStatus = classifyAnomalyStatus(
    anomalyScore,
    flagState.isUnusualPrice,
    flagState.isUnusualVolume,
    flagState.isSilentSignal
  );
  const summaryText = generateSummaryText(metrics, flagState);

  return {
    anomalyScore,
    anomalyStatus,
    isUnusualPrice: flagState.isUnusualPrice,
    isUnusualVolume: flagState.isUnusualVolume,
    isVolumeSpike: flagState.isVolumeSpike,
    isUnusualVolatility: flagState.isUnusualVolatility,
    isSilentSignal: flagState.isSilentSignal,
    flags: flagState.flags,
    summaryText,
    marketRegime,
  };
}
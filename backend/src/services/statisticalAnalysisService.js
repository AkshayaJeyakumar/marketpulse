/**
 * Statistical Analysis Service
 *
 * Deterministic mathematical service for computing rolling statistics,
 * Z-scores, 60-day rolling Beta, and sample metrics for stock market data.
 *
 * PURE FUNCTIONAL MODULE - NO SIDE EFFECTS, NO DB CALLS, NO API CALLS.
 */

/**
 * Safely parse a numeric value with a fallback.
 */

function safeNumber(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Format a timestamp into a YYYY-MM-DD date key string.
 */
function toDateKey(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * 1. Calculate Daily Returns
 *
 * Input: Array of OHLCV points { timestamp, price, volume } sorted chronologically (oldest -> newest).
 * Output: Array of daily returns R_t = (P_t - P_{t-1}) / P_{t-1}.
 * The first element is null because there is no prior reference price.
 */
export function calculateDailyReturns(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return [];
  }

  const returns = [null];

  for (let i = 1; i < points.length; i += 1) {
    const prevPrice = safeNumber(points[i - 1]?.price, 0);
    const currPrice = safeNumber(points[i]?.price, 0);

    if (prevPrice > 0 && currPrice > 0) {
      const dailyReturn = (currPrice - prevPrice) / prevPrice;
      returns.push(Number.isFinite(dailyReturn) ? dailyReturn : null);
    } else {
      returns.push(null);
    }
  }

  return returns;
}

/**
 * 2. Calculate Rolling Mean & Standard Deviation
 *
 * Input: Array of numbers, windowSize (default 20).
 * Math: Sample standard deviation = sqrt( sum((x - mean)^2) / (N - 1) ).
 * Edge Cases: Returns stdDev: 0 if N < 2, stdDev === 0, or isNaN.
 */
export function calculateRollingMeanAndStd(values, windowSize = 20) {
  if (!Array.isArray(values) || values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const cleanValues = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (cleanValues.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const recent = cleanValues.slice(-windowSize);
  const N = recent.length;

  if (N === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const sum = recent.reduce((acc, curr) => acc + curr, 0);
  const mean = sum / N;

  if (N < 2) {
    return {
      mean: Number.isFinite(mean) ? mean : 0,
      stdDev: 0,
    };
  }

  const sumSqDiff = recent.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0);
  const variance = sumSqDiff / (N - 1);

  if (variance <= 0 || !Number.isFinite(variance)) {
    return {
      mean: Number.isFinite(mean) ? mean : 0,
      stdDev: 0,
    };
  }

  const stdDev = Math.sqrt(variance);

  return {
    mean: Number.isFinite(mean) ? mean : 0,
    stdDev: Number.isFinite(stdDev) ? stdDev : 0,
  };
}

/**
 * 3. Calculate Z-Score
 *
 * Output: (currentValue - mean) / stdDev.
 * Edge Cases: Returns 0 if stdDev === 0, isNaN, or non-finite.
 */
export function calculateZScore(currentValue, mean, stdDev) {
  const curr = Number(currentValue);
  const m = Number(mean);
  const s = Number(stdDev);

  if (
    !Number.isFinite(curr) ||
    !Number.isFinite(m) ||
    !Number.isFinite(s) ||
    s === 0
  ) {
    return 0;
  }

  const z = (curr - m) / s;
  return Number.isFinite(z) ? z : 0;
}

/**
 * 4. Calculate Rolling Beta (60-day rolling window)
 *
 * Logic:
 * a. Align stock and benchmark points by matching date keys (YYYY-MM-DD).
 * b. Calculate daily returns for both aligned series.
 * c. Take the most recent windowSize (60) overlapping returns.
 * d. Calculate Covariance(stock, benchmark) and Variance(benchmark).
 * e. Beta = Covariance / Variance.
 * Edge Cases: Returns null if overlapping returns < windowSize or Variance === 0.
 */
export function calculateRollingBeta(stockPoints, benchmarkPoints, windowSize = 60) {
  if (
    !Array.isArray(stockPoints) ||
    !Array.isArray(benchmarkPoints) ||
    stockPoints.length === 0 ||
    benchmarkPoints.length === 0
  ) {
    return null;
  }

  // Build benchmark price Map keyed by YYYY-MM-DD
  const benchmarkMap = new Map();
  for (const point of benchmarkPoints) {
    const key = toDateKey(point?.timestamp);
    const price = safeNumber(point?.price, 0);
    if (key && price > 0) {
      benchmarkMap.set(key, price);
    }
  }

  // Align stock points with benchmark points
  const alignedPairs = [];
  for (const stockPoint of stockPoints) {
    const key = toDateKey(stockPoint?.timestamp);
    const stockPrice = safeNumber(stockPoint?.price, 0);
    const benchmarkPrice = benchmarkMap.get(key);

    if (key && stockPrice > 0 && benchmarkPrice && benchmarkPrice > 0) {
      alignedPairs.push({
        dateKey: key,
        stockPrice,
        benchmarkPrice,
      });
    }
  }

  if (alignedPairs.length < 2) {
    return null;
  }

  // Compute daily returns for aligned pairs
  const alignedReturns = [];
  for (let i = 1; i < alignedPairs.length; i += 1) {
    const prevStock = alignedPairs[i - 1].stockPrice;
    const currStock = alignedPairs[i].stockPrice;
    const prevBench = alignedPairs[i - 1].benchmarkPrice;
    const currBench = alignedPairs[i].benchmarkPrice;

    const stockReturn = (currStock - prevStock) / prevStock;
    const benchReturn = (currBench - prevBench) / prevBench;

    if (Number.isFinite(stockReturn) && Number.isFinite(benchReturn)) {
      alignedReturns.push({
        stockReturn,
        benchReturn,
      });
    }
  }

  if (alignedReturns.length < windowSize) {
    return null;
  }

  // Take most recent windowSize overlapping return pairs
  const recent = alignedReturns.slice(-windowSize);
  const N = recent.length;

  const meanStock = recent.reduce((acc, r) => acc + r.stockReturn, 0) / N;
  const meanBench = recent.reduce((acc, r) => acc + r.benchReturn, 0) / N;

  let covarianceSum = 0;
  let benchVarSum = 0;

  for (const pair of recent) {
    const stockDiff = pair.stockReturn - meanStock;
    const benchDiff = pair.benchReturn - meanBench;

    covarianceSum += stockDiff * benchDiff;
    benchVarSum += benchDiff * benchDiff;
  }

  const covariance = covarianceSum / (N - 1);
  const benchVariance = benchVarSum / (N - 1);

  if (benchVariance <= 0 || !Number.isFinite(benchVariance) || !Number.isFinite(covariance)) {
    return null;
  }

  const beta = covariance / benchVariance;
  return Number.isFinite(beta) ? beta : null;
}

/**
 * 5. Compute Stock Statistics (Main Entrypoint)
 *
 * Input: stockPoints (>= 90 days), benchmarkPoints (>= 90 days).
 * Output: StockStatisticalMetrics object shape.
 */
export function computeStockStatistics(stockPoints, benchmarkPoints) {
  const cleanStockPoints = Array.isArray(stockPoints) ? stockPoints : [];
  const cleanBenchPoints = Array.isArray(benchmarkPoints) ? benchmarkPoints : [];

  const latestStockPoint = cleanStockPoints[cleanStockPoints.length - 1] || {};
  const currentPrice = safeNumber(latestStockPoint.price, 0);
  const currentVolume = safeNumber(latestStockPoint.volume, 0);

  // Compute daily returns
  const stockReturns = calculateDailyReturns(cleanStockPoints).filter((r) => r !== null);
  const benchReturns = calculateDailyReturns(cleanBenchPoints).filter((r) => r !== null);

  const latestReturn = stockReturns.length > 0 ? stockReturns[stockReturns.length - 1] : 0;
  const benchmarkLatestReturn = benchReturns.length > 0 ? benchReturns[benchReturns.length - 1] : null;

  // 20-day rolling return stats
  const { mean: returnMean20, stdDev: returnStd20 } = calculateRollingMeanAndStd(stockReturns, 20);
  const returnZScore = calculateZScore(latestReturn, returnMean20, returnStd20);

  // 20-day rolling volume stats
  const stockVolumes = cleanStockPoints
    .map((p) => safeNumber(p.volume, 0))
    .filter((v) => v > 0);

  const { mean: volumeMean20, stdDev: volumeStd20 } = calculateRollingMeanAndStd(stockVolumes, 20);
  const volumeRatio = volumeMean20 > 0 ? currentVolume / volumeMean20 : 1;
  const volumeZScore = calculateZScore(currentVolume, volumeMean20, volumeStd20);

  // 20-day volatility stats (volatility20 is returnStd20)
  const volatility20 = returnStd20;
  const absReturns = stockReturns.map((r) => Math.abs(r));
  const { mean: absMean20, stdDev: absStd20 } = calculateRollingMeanAndStd(absReturns, 20);
  const volatilityZScore = calculateZScore(Math.abs(latestReturn), absMean20, absStd20);

  // 60-day rolling Beta
  const beta60 = calculateRollingBeta(cleanStockPoints, cleanBenchPoints, 60);

  // Align dates to count sample size
  const benchDateMap = new Set();
  for (const p of cleanBenchPoints) {
    const k = toDateKey(p?.timestamp);
    if (k) benchDateMap.add(k);
  }

  let sampleSize = 0;
  for (const p of cleanStockPoints) {
    const k = toDateKey(p?.timestamp);
    if (k && benchDateMap.has(k)) {
      sampleSize += 1;
    }
  }

  // Adjust sampleSize to return pairs count (sampleSize - 1)
  const validReturnPairs = Math.max(0, sampleSize - 1);

  // CAPM Movement Attribution Logic
  const marketDrivenReturn = (beta60 !== null && benchmarkLatestReturn !== null)
    ? beta60 * benchmarkLatestReturn
    : null;

  const stockSpecificReturn = marketDrivenReturn !== null
    ? latestReturn - marketDrivenReturn
    : null;

  let marketSharePct = null;
  let stockSharePct = null;

  if (marketDrivenReturn !== null && stockSpecificReturn !== null) {
    const absMarket = Math.abs(marketDrivenReturn);
    const absStock = Math.abs(stockSpecificReturn);
    const totalAbs = absMarket + absStock;

    if (totalAbs > 0) {
      marketSharePct = Math.round((absMarket / totalAbs) * 100);
      stockSharePct = 100 - marketSharePct;
    } else {
      marketSharePct = 50;
      stockSharePct = 50;
    }
  }

  const attributionStatus = (beta60 !== null && marketSharePct !== null) ? 'ok' : 'insufficient_data';

  return {
    currentPrice: Number(currentPrice.toFixed(2)),
    currentVolume,
    latestReturn: Number(latestReturn.toFixed(6)),
    returnMean20: Number(returnMean20.toFixed(6)),
    returnStd20: Number(returnStd20.toFixed(6)),
    returnZScore: Number(returnZScore.toFixed(4)),
    volumeMean20: Math.round(volumeMean20),
    volumeStd20: Math.round(volumeStd20),
    volumeRatio: Number(volumeRatio.toFixed(4)),
    volumeZScore: Number(volumeZScore.toFixed(4)),
    volatility20: Number(volatility20.toFixed(6)),
    volatilityZScore: Number(volatilityZScore.toFixed(4)),
    beta60: beta60 !== null ? Number(beta60.toFixed(4)) : null,
    benchmarkLatestReturn: benchmarkLatestReturn !== null ? Number(benchmarkLatestReturn.toFixed(6)) : null,
    sampleSize: validReturnPairs,
    hasSufficientHistory20: validReturnPairs >= 20,
    hasSufficientHistory60: validReturnPairs >= 60,
    marketSharePct,
    stockSharePct,
    attributionStatus,
  };
}


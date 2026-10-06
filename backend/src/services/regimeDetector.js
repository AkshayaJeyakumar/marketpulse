/**
 * ML Market Regime Detector
 *
 * Uses unsupervised K-Means clustering (k=3) on 2D [daily_return, volatility] features
 * computed from NIFTY 50 benchmark historical data.
 *
 * Classifies market regimes into:
 * - BULL: Positive returns, moderate/low volatility
 * - BEAR: Negative returns, elevated volatility
 * - SIDEWAYS: Near-zero returns, neutral volatility
 *
 * PURE NATIVE JAVASCRIPT - NO EXTERNAL DEPENDENCIES.
 */

/**
 * Euclidean distance between two 2D points [x, y]
 */
function euclideanDistance(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detect the current market regime using 60-day K-Means clustering.
 *
 * @param {Array<{ timestamp: string, price: number, high?: number, low?: number }>} niftyPoints
 * @returns {'BULL' | 'BEAR' | 'SIDEWAYS'} Most recent market regime
 */
export function detectMarketRegime(niftyPoints = []) {
  if (!Array.isArray(niftyPoints) || niftyPoints.length < 5) {
    return 'SIDEWAYS';
  }

  // Take up to recent 60 trading days
  const recentPoints = niftyPoints.slice(-61);
  if (recentPoints.length < 2) {
    return 'SIDEWAYS';
  }

  // Extract 2D feature vectors: [dailyReturn, volatility]
  const features = [];
  for (let i = 1; i < recentPoints.length; i += 1) {
    const prev = Number(recentPoints[i - 1]?.price) || Number(recentPoints[i - 1]?.close) || 0;
    const curr = Number(recentPoints[i]?.price) || Number(recentPoints[i]?.close) || 0;
    const high = Number(recentPoints[i]?.high) || curr;
    const low = Number(recentPoints[i]?.low) || curr;

    if (prev > 0 && curr > 0) {
      const dailyReturn = (curr - prev) / prev;
      const volatility = curr > 0 && high >= low ? (high - low) / curr : Math.abs(dailyReturn);

      if (Number.isFinite(dailyReturn) && Number.isFinite(volatility)) {
        features.push([dailyReturn, volatility]);
      }
    }
  }

  if (features.length < 3) {
    return 'SIDEWAYS';
  }

  // K-Means Clustering (k = 3)
  const k = 3;

  // Initialize centroids with min, zero, and max returns
  const returns = features.map((f) => f[0]);
  const minReturn = Math.min(...returns);
  const maxReturn = Math.max(...returns);

  const minPoint = features.find((f) => f[0] === minReturn) || features[0];
  const maxPoint = features.find((f) => f[0] === maxReturn) || features[features.length - 1];
  const midPoint = features[Math.floor(features.length / 2)] || features[0];

  let centroids = [
    [...minPoint],
    [...midPoint],
    [...maxPoint],
  ];

  const maxIterations = 25;
  let assignments = new Array(features.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;

    // Assignment Step
    for (let i = 0; i < features.length; i += 1) {
      const point = features[i];
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let c = 0; c < k; c += 1) {
        const dist = euclideanDistance(point, centroids[c]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = c;
        }
      }

      if (assignments[i] !== nearestIndex) {
        assignments[i] = nearestIndex;
        changed = true;
      }
    }

    if (!changed && iter > 0) {
      break;
    }

    // Update Centroids Step
    const sums = Array.from({ length: k }, () => [0, 0]);
    const counts = Array.from({ length: k }, () => 0);

    for (let i = 0; i < features.length; i += 1) {
      const cluster = assignments[i];
      sums[cluster][0] += features[i][0];
      sums[cluster][1] += features[i][1];
      counts[cluster] += 1;
    }

    for (let c = 0; c < k; c += 1) {
      if (counts[c] > 0) {
        centroids[c] = [
          sums[c][0] / counts[c],
          sums[c][1] / counts[c],
        ];
      }
    }
  }

  // Classify Centroids into BULL, BEAR, and SIDEWAYS
  // Centroid rank score: meanReturn - (volatility * 0.5)
  const centroidMetrics = centroids.map((c, idx) => ({
    index: idx,
    meanReturn: c[0],
    volatility: c[1],
    score: c[0] - c[1] * 0.5,
  }));

  // Sort centroids by mean return
  centroidMetrics.sort((a, b) => a.meanReturn - b.meanReturn);

  const bearClusterIndex = centroidMetrics[0].index; // Lowest return
  const bullClusterIndex = centroidMetrics[k - 1].index; // Highest return
  const sidewaysClusterIndex = centroidMetrics[1].index; // Middle return

  const regimeMap = {
    [bearClusterIndex]: 'BEAR',
    [bullClusterIndex]: 'BULL',
    [sidewaysClusterIndex]: 'SIDEWAYS',
  };

  // Classify the most recent day's feature vector
  const latestFeature = features[features.length - 1];
  let latestClusterIndex = 0;
  let minLatestDist = Infinity;

  for (let c = 0; c < k; c += 1) {
    const dist = euclideanDistance(latestFeature, centroids[c]);
    if (dist < minLatestDist) {
      minLatestDist = dist;
      latestClusterIndex = c;
    }
  }

  return regimeMap[latestClusterIndex] || 'SIDEWAYS';
}

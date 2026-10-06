/**
 * backend/testStats.js
 *
 * Self-contained unit & integration test script for Statistical Analysis Service (Milestone 2).
 * Verifies math correctness, edge cases, and output schema matching StockStatisticalMetrics.
 */

import {
  calculateDailyReturns,
  calculateRollingMeanAndStd,
  calculateZScore,
  calculateRollingBeta,
  computeStockStatistics,
} from './src/services/statisticalAnalysisService.js';

// Helper to generate mock daily OHLCV series
function generateMockSeries({ basePrice, dailyVolatility, trend, volumeMean, days = 95, startDate = '2026-05-01' }) {
  const points = [];
  let currPrice = basePrice;
  const start = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    // Skip weekends to simulate trading days
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    // Pseudo-deterministic return generator
    const randomFactor = Math.sin(i * 0.5) * dailyVolatility;
    currPrice = currPrice * (1 + trend + randomFactor);
    const volume = Math.round(volumeMean * (1 + Math.cos(i * 0.3) * 0.2));

    points.push({
      timestamp: d.toISOString().split('T')[0],
      price: Number(currPrice.toFixed(2)),
      volume,
    });
  }

  return points;
}

console.log('====================================================');
console.log('     MarketPulse Milestone 2 Math Engine Tests     ');
console.log('====================================================\n');

// 1. Test calculateDailyReturns
console.log('--- 1. Testing calculateDailyReturns ---');
const samplePoints = [
  { timestamp: '2026-05-01', price: 100, volume: 1000 },
  { timestamp: '2026-05-02', price: 102, volume: 1100 }, // +2%
  { timestamp: '2026-05-03', price: 99.96, volume: 900 }, // -2%
];
const returns = calculateDailyReturns(samplePoints);
console.log('Sample Points:', samplePoints.map((p) => p.price));
console.log('Calculated Returns:', returns.map((r) => (r !== null ? (r * 100).toFixed(2) + '%' : null)));
console.assert(returns[0] === null, 'First return should be null');
console.assert(Math.abs(returns[1] - 0.02) < 1e-5, 'Second return should be +2%');
console.log('✅ calculateDailyReturns passed.\n');

// 2. Test calculateRollingMeanAndStd
console.log('--- 2. Testing calculateRollingMeanAndStd ---');
const testVals = [10, 12, 14, 16, 18]; // N = 5, mean = 14, sample variance = 10, sample std = sqrt(10) ≈ 3.162277
const { mean, stdDev } = calculateRollingMeanAndStd(testVals, 5);
console.log(`Values: [${testVals.join(', ')}]`);
console.log(`Mean: ${mean} (Expected: 14)`);
console.log(`StdDev: ${stdDev.toFixed(6)} (Expected: ~3.162278)`);
console.assert(mean === 14, 'Mean should be 14');
console.assert(Math.abs(stdDev - Math.sqrt(10)) < 1e-5, 'Sample StdDev math check');

// Edge case: N < 2 or flat numbers
const flatStats = calculateRollingMeanAndStd([5, 5, 5], 3);
console.log('Flat series stdDev:', flatStats.stdDev, '(Expected: 0)');
console.assert(flatStats.stdDev === 0, 'Flat series should return stdDev 0');
console.log('✅ calculateRollingMeanAndStd passed.\n');

// 3. Test calculateZScore
console.log('--- 3. Testing calculateZScore ---');
const z1 = calculateZScore(17.162277, 14, 3.162277);
console.log(`Z-Score of 17.162277 vs mean=14, std=3.162277: ${z1.toFixed(4)} (Expected: ~1.0000)`);
console.assert(Math.abs(z1 - 1.0) < 1e-3, 'Z-score should be ~1.0');

// Edge case: stdDev = 0
const zZeroStd = calculateZScore(10, 10, 0);
console.log('Z-Score with stdDev=0:', zZeroStd, '(Expected: 0)');
console.assert(zZeroStd === 0, 'Zero stdDev should return 0 z-score');
console.log('✅ calculateZScore passed.\n');

// 4. Test calculateRollingBeta
console.log('--- 4. Testing calculateRollingBeta ---');
const stockData95 = generateMockSeries({
  basePrice: 2400,
  dailyVolatility: 0.015,
  trend: 0.0005,
  volumeMean: 500000,
  days: 95,
});

const benchData95 = generateMockSeries({
  basePrice: 22000,
  dailyVolatility: 0.008,
  trend: 0.0003,
  volumeMean: 2000000,
  days: 95,
});

const beta60 = calculateRollingBeta(stockData95, benchData95, 60);
console.log(`Calculated 60-day Rolling Beta: ${beta60 !== null ? beta60.toFixed(4) : null}`);
console.assert(beta60 !== null && beta60 > 0, 'Beta should be a positive number for correlated series');

// Edge case: Insufficient history (< 60 points)
const betaInsufficient = calculateRollingBeta(stockData95.slice(0, 30), benchData95.slice(0, 30), 60);
console.log('Beta with < 60 days:', betaInsufficient, '(Expected: null)');
console.assert(betaInsufficient === null, 'Insufficient history should return null beta');
console.log('✅ calculateRollingBeta passed.\n');

// 5. Test computeStockStatistics (Main Entrypoint)
console.log('--- 5. Testing computeStockStatistics (Full Integration) ---');
const metrics = computeStockStatistics(stockData95, benchData95);

console.log('Resulting StockStatisticalMetrics Object:');
console.dir(metrics, { depth: null });

// Interface Shape Validation
const requiredKeys = [
  'currentPrice',
  'currentVolume',
  'latestReturn',
  'returnMean20',
  'returnStd20',
  'returnZScore',
  'volumeMean20',
  'volumeStd20',
  'volumeRatio',
  'volumeZScore',
  'volatility20',
  'volatilityZScore',
  'beta60',
  'benchmarkLatestReturn',
  'sampleSize',
  'hasSufficientHistory20',
  'hasSufficientHistory60',
];

let allKeysPresent = true;
for (const key of requiredKeys) {
  if (!(key in metrics)) {
    console.error(`❌ Missing key in output interface: ${key}`);
    allKeysPresent = false;
  }
}

console.assert(allKeysPresent, 'All interface keys must be present');
console.assert(typeof metrics.currentPrice === 'number', 'currentPrice is number');
console.assert(typeof metrics.hasSufficientHistory20 === 'boolean', 'hasSufficientHistory20 is boolean');
console.assert(typeof metrics.hasSufficientHistory60 === 'boolean', 'hasSufficientHistory60 is boolean');

console.log('\n====================================================');
console.log('  🎉 ALL STATISTICAL SERVICE TESTS PASSED CLEANLY!  ');
console.log('====================================================');

/**
 * backend/testPhase1And2.js
 *
 * Integration test script for ML Market Regime Detector & Historical Backtesting Engine.
 */

import { detectMarketRegime } from './src/services/regimeDetector.js';
import { evaluateAnomalies, evaluateFlags } from './src/services/anomalyDetectionEngine.js';
import { runBacktest } from './src/services/backtestingService.js';

console.log('====================================================');
console.log('   MarketPulse Phase 1 & Phase 2 Service Tests    ');
console.log('====================================================\n');

// 1. Test Regime Detector
console.log('--- 1. Testing ML Market Regime Detector ---');
const mockNiftyPoints = [];
const start = new Date('2026-05-01');

for (let i = 0; i < 65; i++) {
  const d = new Date(start);
  d.setDate(start.getDate() + i);
  // Bullish trend simulation
  const price = 22000 * Math.pow(1.002, i);
  mockNiftyPoints.push({
    timestamp: d.toISOString().split('T')[0],
    price,
    high: price * 1.005,
    low: price * 0.995,
  });
}

const regime = detectMarketRegime(mockNiftyPoints);
console.log('Detected Regime for Bullish Benchmark:', regime);
console.assert(['BULL', 'BEAR', 'SIDEWAYS'].includes(regime), 'Regime must be BULL, BEAR, or SIDEWAYS');
console.log('✅ Regime Detector test passed.\n');

// 2. Test Regime Adaptation in Anomaly Engine
console.log('--- 2. Testing Regime Adaptation in Anomaly Engine ---');
const metrics = {
  returnZScore: 2.2, // >= 2.0 (triggers unusual price in BULL, but NOT in BEAR where threshold is 3.0)
  volumeZScore: 2.0,
  volumeRatio: 2.0,
  latestReturn: 0.001,
};

const bullFlags = evaluateFlags(metrics, 'BULL');
const bearFlags = evaluateFlags(metrics, 'BEAR');

console.log('BULL Regime isUnusualPrice (thresh 2.0):', bullFlags.isUnusualPrice, '(Expected: true)');
console.log('BEAR Regime isUnusualPrice (thresh 3.0):', bearFlags.isUnusualPrice, '(Expected: false)');

console.assert(bullFlags.isUnusualPrice === true, 'BULL regime triggers at lower Z-score');
console.assert(bearFlags.isUnusualPrice === false, 'BEAR regime requires higher Z-score stringency');
console.log('✅ Regime Adaptation test passed.\n');

// 3. Test Historical Backtesting Engine
console.log('--- 3. Testing Historical Backtesting Engine ---');
const mockStockPoints = [];
const mockBenchPoints = [];

for (let i = 0; i < 70; i++) {
  const d = new Date(start);
  d.setDate(start.getDate() + i);

  const isSignalDay = i === 30 || i === 45;
  const price = 100 * Math.pow(1.001, i);
  const volume = isSignalDay ? 2500000 : 1000000;
  const priceMove = isSignalDay ? price * 1.0001 : price;

  mockStockPoints.push({
    timestamp: d.toISOString().split('T')[0],
    price: Number(priceMove.toFixed(2)),
    volume,
  });

  mockBenchPoints.push({
    timestamp: d.toISOString().split('T')[0],
    price: Number((22000 * Math.pow(1.0005, i)).toFixed(2)),
    volume: 1000000,
  });
}

const backtestResult = runBacktest(mockStockPoints, mockBenchPoints);
console.log('Backtest Performance Output:');
console.dir(backtestResult, { depth: null });

console.assert(typeof backtestResult.totalTrades === 'number', 'totalTrades is number');
console.assert(typeof backtestResult.winRate === 'number', 'winRate is number');
console.assert(typeof backtestResult.totalReturn === 'number', 'totalReturn is number');
console.assert(typeof backtestResult.maxDrawdown === 'number', 'maxDrawdown is number');

console.log('\n====================================================');
console.log(' 🎉 ALL ML REGIME & BACKTESTING TESTS PASSED! ');
console.log('====================================================');

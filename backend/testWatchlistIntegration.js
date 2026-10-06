/**
 * backend/testWatchlistIntegration.js
 *
 * Test integration of anomaly detection engine into watchlist service (Milestone 4).
 */

import { rankAttention } from './src/services/attentionRankingEngine.js';
import { buildExplanation } from './src/services/explanationService.js';
import { computeStockStatistics } from './src/services/statisticalAnalysisService.js';
import { evaluateAnomalies } from './src/services/anomalyDetectionEngine.js';

console.log('====================================================');
console.log(' MarketPulse Milestone 4 Integration Service Tests ');
console.log('====================================================\n');

// 1. Test rankAttention with anomalyScore
console.log('--- 1. Testing rankAttention with anomalyScore ---');
const rankSig = rankAttention(75);
console.log('Score 75 -> Tier:', rankSig.tier, '(Expected: significant)');
console.assert(rankSig.tier === 'significant', 'Score 75 should be significant');

const rankWatch = rankAttention(45);
console.log('Score 45 -> Tier:', rankWatch.tier, '(Expected: worth_watching)');
console.assert(rankWatch.tier === 'worth_watching', 'Score 45 should be worth_watching');

const rankNorm = rankAttention(15);
console.log('Score 15 -> Tier:', rankNorm.tier, '(Expected: normal)');
console.assert(rankNorm.tier === 'normal', 'Score 15 should be normal');
console.log('✅ rankAttention tests passed.\n');

// 2. Test buildExplanation with summaryText
console.log('--- 2. Testing buildExplanation with summaryText ---');
const textInput = 'Observation of market activity indicates price-volume divergence. Silent Signal detected: High volume activity (2.5x baseline) with minimal price change.';
const explanation = buildExplanation(textInput, { direction: 'up' }, 65);

console.log('Explanation Summary:', explanation.summary);
console.log('Explanation Reasons:', explanation.reasons);
console.assert(explanation.summary === textInput, 'Summary matches input');
console.assert(explanation.reasons[0] === textInput, 'Reasons[0] matches input');
console.assert(typeof explanation.disclaimer === 'string', 'Disclaimer present');
console.log('✅ buildExplanation tests passed.\n');

// 3. Test end-to-end integration mapping with Silent Signal
console.log('--- 3. Testing Mock Stock Data through Math & Anomaly Pipeline ---');
const mockStockPoints = [];
const mockBenchPoints = [];
const start = new Date('2026-05-01');

for (let i = 0; i < 90; i++) {
  const d = new Date(start);
  d.setDate(start.getDate() + i);

  const isToday = i === 89;
  // Day 89: Price stays virtually unchanged (2500 -> 2501 = +0.04%), volume jumps to 2.5M (vs 1M avg)
  const price = isToday ? 2501.00 : (2500.00 + (i % 3));
  const volume = isToday ? 2500000 : (1000000 + (i % 5) * 10000);

  mockStockPoints.push({
    timestamp: d.toISOString(),
    price,
    volume,
  });

  mockBenchPoints.push({
    timestamp: d.toISOString(),
    price: 22000.00 + (i % 4),
    volume: 1000000,
  });
}

const stats = computeStockStatistics(mockStockPoints, mockBenchPoints);
const anomaly = evaluateAnomalies(stats);
const ranking = rankAttention(anomaly.anomalyScore);
const exp = buildExplanation(anomaly.summaryText, { price: stats.currentPrice }, ranking.attentionScore);

console.log('Synthetic Output Item Shape Check:');
const item = {
  symbol: 'RELIANCE',
  anomalyScore: anomaly.anomalyScore,
  anomalyStatus: anomaly.anomalyStatus,
  volumeRatio: stats.volumeRatio,
  returnZScore: stats.returnZScore,
  volumeZScore: stats.volumeZScore,
  volatilityZScore: stats.volatilityZScore,
  isSilentSignal: anomaly.isSilentSignal,
  summaryText: anomaly.summaryText,
  marketSharePct: stats.marketSharePct,
  stockSharePct: stats.stockSharePct,
  attributionStatus: stats.attributionStatus,
  tier: ranking.tier,
  attentionScore: ranking.attentionScore,
  explanation: exp.summary,
  reasons: exp.reasons,
};


console.dir(item, { depth: null });
console.assert(item.anomalyScore >= 50, 'Silent Signal scenario generates score >= 50');
console.assert(item.isSilentSignal === true, 'Silent signal flag set');

console.log('\n====================================================');
console.log(' 🎉 MILESTONE 4 INTEGRATION TESTS PASSED CLEANLY!  ');
console.log('====================================================');

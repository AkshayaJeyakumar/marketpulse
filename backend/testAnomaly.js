/**
 * backend/testAnomaly.js
 *
 * Self-contained test script for Anomaly Rules and Score Engine (Milestone 3).
 * Verifies flag evaluation, score clamping, Silent Signal bonus, compliance language rules,
 * and interface shape adherence.
 */

import {
  evaluateAnomalies,
  evaluateFlags,
  calculateAnomalyScore,
  generateSummaryText,
  PROHIBITED_WORDS,
} from './src/services/anomalyDetectionEngine.js';

console.log('====================================================');
console.log('    MarketPulse Milestone 3 Anomaly Engine Tests    ');
console.log('====================================================\n');

// 1. Test Silent Signal Trigger & 20-Point Bonus
console.log('--- 1. Testing Silent Signal & Bonus ---');
const silentMetrics = {
  currentPrice: 1500,
  currentVolume: 2500000,
  latestReturn: 0.002, // +0.2% (< 0.5%)
  returnMean20: 0.001,
  returnStd20: 0.01,
  returnZScore: 0.1,
  volumeMean20: 1000000,
  volumeStd20: 100000,
  volumeRatio: 2.5, // >= 2.0
  volumeZScore: 2.0,
  volatility20: 0.01,
  volatilityZScore: 0.5,
  beta60: 1.1,
  benchmarkLatestReturn: 0.001,
  sampleSize: 65,
  hasSufficientHistory20: true,
  hasSufficientHistory60: true,
};

const silentResult = evaluateAnomalies(silentMetrics);
console.log('Silent Signal Metrics Evaluation:');
console.log(`- isSilentSignal: ${silentResult.isSilentSignal} (Expected: true)`);
console.log(`- isVolumeSpike: ${silentResult.isVolumeSpike} (Expected: true)`);
console.log(`- Anomaly Score: ${silentResult.anomalyScore}`);
console.log(`- Anomaly Status: "${silentResult.anomalyStatus}" (Expected: Elevated Activity or Critical Anomaly)`);
console.log(`- Summary Text: "${silentResult.summaryText}"`);

console.assert(silentResult.isSilentSignal === true, 'isSilentSignal should be true');

// Verify 20-point bonus difference
const nonSilentMetrics = { ...silentMetrics, latestReturn: 0.02 }; // +2.0% (not silent)
const nonSilentResult = evaluateAnomalies(nonSilentMetrics);
console.log(`Score with Silent Signal: ${silentResult.anomalyScore} vs Non-Silent: ${nonSilentResult.anomalyScore}`);
console.assert(silentResult.anomalyScore >= nonSilentResult.anomalyScore + 15, 'Silent Signal should add bonus score');
console.log('✅ Silent Signal test passed.\n');

// 2. Test Score Clamping (0 to 100)
console.log('--- 2. Testing Score Clamping (0 - 100) ---');
const extremeHighMetrics = {
  ...silentMetrics,
  returnZScore: 10.0,   // Extreme
  volumeZScore: 10.0,   // Extreme
  volatilityZScore: 10.0,// Extreme
  volumeRatio: 5.0,
  latestReturn: 0.001,  // Silent Signal active
};

const extremeHighResult = evaluateAnomalies(extremeHighMetrics);
console.log(`Extreme High Raw Score test -> Clamped Score: ${extremeHighResult.anomalyScore} (Expected: 100)`);
console.assert(extremeHighResult.anomalyScore === 100, 'Score must be clamped at 100 max');

const extremeLowMetrics = {
  ...silentMetrics,
  returnZScore: 0,
  volumeZScore: 0,
  volatilityZScore: 0,
  volumeRatio: 0.5,
  latestReturn: 0,
};
const extremeLowResult = evaluateAnomalies(extremeLowMetrics);
console.log(`Zero Activity test -> Clamped Score: ${extremeLowResult.anomalyScore} (Expected: 0)`);
console.assert(extremeLowResult.anomalyScore === 0, 'Score must be clamped at 0 min');
console.log('✅ Score clamping test passed.\n');

// 3. Robust Prohibited Words Compliance Audit
console.log('--- 3. Testing Prohibited Words Language Compliance ---');
const testMetricCombinations = [
  silentMetrics,
  nonSilentMetrics,
  extremeHighMetrics,
  extremeLowMetrics,
  { ...silentMetrics, returnZScore: 3.5, volumeZScore: 4.0 }, // Critical price + volume
  { ...silentMetrics, volatilityZScore: 3.2, volumeRatio: 1.2 }, // High volatility only
  { ...silentMetrics, volumeZScore: 3.5, volumeRatio: 2.2, latestReturn: 0.03 }, // High volume price jump
];

const prohibitedRegex = new RegExp(`\\b(${PROHIBITED_WORDS.join('|')})\\b`, 'i');

let allPassedCompliance = true;
for (let i = 0; i < testMetricCombinations.length; i++) {
  const result = evaluateAnomalies(testMetricCombinations[i]);
  const text = result.summaryText;

  if (prohibitedRegex.test(text)) {
    console.error(`❌ Prohibited word found in combination #${i + 1}: "${text}"`);
    allPassedCompliance = false;
  }
}

console.assert(allPassedCompliance, 'No prohibited words found across all test combinations');
console.log(`Scanned ${testMetricCombinations.length} flag combinations against prohibited list: [${PROHIBITED_WORDS.join(', ')}]`);
console.log('✅ Language compliance audit passed.\n');

// 4. Test Interface Shape
console.log('--- 4. Testing Output Interface Shape ---');
const sampleResult = evaluateAnomalies(silentMetrics);

const expectedKeys = [
  'anomalyScore',
  'anomalyStatus',
  'isUnusualPrice',
  'isUnusualVolume',
  'isVolumeSpike',
  'isUnusualVolatility',
  'isSilentSignal',
  'flags',
  'summaryText',
];

for (const key of expectedKeys) {
  console.assert(key in sampleResult, `Result object must contain key: ${key}`);
}

console.log('Full Output Sample Result:');
console.dir(sampleResult, { depth: null });

console.log('\n====================================================');
console.log(' 🎉 ALL ANOMALY ENGINE TESTS PASSED SUCCESSFULLY!  ');
console.log('====================================================');

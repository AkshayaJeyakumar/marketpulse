import { computeStockStatistics } from './src/services/statisticalAnalysisService.js';
import { evaluateAnomalies } from './src/services/anomalyDetectionEngine.js';

// 1. Generate 90 days of MOCK data for a stock (e.g., "RELIANCE")
function generateMockStockData() {
    const points = [];
    let price = 2400;
    let volume = 500000;
    const today = new Date();

    for (let i = 90; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        // Skip weekends for realism
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        // Simulate a "Silent Signal" day on the very last day: Huge volume, tiny price change
        const isToday = i === 0;
        const priceChange = isToday ? 0.001 : (Math.random() - 0.5) * 0.02; // 0.1% move today, normal otherwise
        const volumeMultiplier = isToday ? 3.5 : 1 + (Math.random() - 0.5) * 0.5; // 3.5x volume today!

        price = price * (1 + priceChange);
        volume = Math.round(volume * volumeMultiplier);

        points.push({
            timestamp: d.toISOString().split('T')[0],
            price: Number(price.toFixed(2)),
            volume: volume
        });
    }
    return points;
}

// 2. Generate 90 days of MOCK data for NIFTY 50 Benchmark
function generateMockBenchmarkData() {
    const points = [];
    let price = 22000;
    const today = new Date();

    for (let i = 90; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        price = price * (1 + (Math.random() - 0.5) * 0.01);
        points.push({
            timestamp: d.toISOString().split('T')[0],
            price: Number(price.toFixed(2)),
            volume: 1000000
        });
    }
    return points;
}

// 3. Run the engines
console.log("🚀 MarketPulse Anomaly Detection Playground\n");

const stockPoints = generateMockStockData();
const benchmarkPoints = generateMockBenchmarkData();

console.log("📊 Step 1: Calculating Statistical Metrics...");
const metrics = computeStockStatistics(stockPoints, benchmarkPoints);

console.log("🔍 Step 2: Evaluating Anomaly Rules...");
const anomalyResult = evaluateAnomalies(metrics);

// 4. Print a beautiful report
console.log("\n========================================");
console.log("📈 ANOMALY DETECTION REPORT: RELIANCE");
console.log("========================================");
console.log(`Current Price:      ₹${metrics.currentPrice}`);
console.log(`Daily Return:       ${(metrics.latestReturn * 100).toFixed(2)}%`);
console.log(`Volume Ratio:       ${metrics.volumeRatio.toFixed(2)}x (vs 20-day avg)`);
console.log(`Return Z-Score:     ${metrics.returnZScore.toFixed(2)}σ`);
console.log(`Volume Z-Score:     ${metrics.volumeZScore.toFixed(2)}σ`);
console.log(`60-Day Beta:        ${metrics.beta60}`);
console.log("----------------------------------------");
console.log(`🚨 Anomaly Score:     ${anomalyResult.anomalyScore} / 100`);
console.log(`⚠️  Status:           ${anomalyResult.anomalyStatus}`);
console.log(`🏷️  Flags:            ${anomalyResult.flags.join(', ')}`);
console.log("----------------------------------------");
console.log(`💬 AI Summary:\n"${anomalyResult.summaryText}"`);
console.log("========================================\n");
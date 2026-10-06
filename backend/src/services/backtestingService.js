/**
 * Historical Backtesting Engine
 *
 * Simulates an anomaly-driven momentum strategy on historical stock candles against the ^NSEI benchmark.
 *
 * Strategy Rule:
 * - Enter trade (BUY) when Anomaly Detection triggers a Silent Signal OR Anomaly Score >= 60.
 * - Exit trade (SELL) 5 trading days later.
 * - Capital allocated dynamically with compounding returns.
 *
 * PURE FUNCTIONAL MODULE - NO SIDE EFFECTS, NO DATABASE CALLS.
 */

import { computeStockStatistics } from './statisticalAnalysisService.js';
import { evaluateAnomalies } from './anomalyDetectionEngine.js';

/**
 * Run historical backtest strategy on stock candles.
 *
 * @param {Array<{ timestamp: string, price: number, volume: number }>} stockPoints
 * @param {Array<{ timestamp: string, price: number, volume: number }>} benchmarkPoints
 * @returns {{
 *   strategyName: string,
 *   totalTrades: number,
 *   winRate: number,
 *   totalReturn: number,
 *   maxDrawdown: number,
 *   finalPortfolioValue: number
 * }} Backtest performance report
 */
export function runBacktest(stockPoints = [], benchmarkPoints = []) {
  const initialCapital = 100000;
  let portfolioValue = initialCapital;
  let peakPortfolio = initialCapital;
  let maxDrawdown = 0;
  let totalTrades = 0;
  let wins = 0;

  if (
    !Array.isArray(stockPoints) ||
    !Array.isArray(benchmarkPoints) ||
    stockPoints.length < 25 ||
    benchmarkPoints.length < 25
  ) {
    return {
      strategyName: 'MarketPulse Anomaly & Silent Signal Momentum Strategy',
      totalTrades: 0,
      winRate: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      finalPortfolioValue: initialCapital,
    };
  }

  const minWindow = 20;
  const holdPeriodDays = 5;

  for (let i = minWindow; i <= stockPoints.length - holdPeriodDays; i += 1) {
    const stockSlice = stockPoints.slice(0, i + 1);
    const benchSlice = benchmarkPoints.slice(0, Math.min(i + 1, benchmarkPoints.length));

    const metrics = computeStockStatistics(stockSlice, benchSlice);
    const anomaly = evaluateAnomalies(metrics);

    // Strategy Trigger: Silent Signal OR Anomaly Score >= 60
    if (anomaly.isSilentSignal || anomaly.anomalyScore >= 60) {
      const buyPoint = stockPoints[i];
      const sellPoint = stockPoints[i + holdPeriodDays];

      const buyPrice = Number(buyPoint?.price) || Number(buyPoint?.close) || 0;
      const sellPrice = Number(sellPoint?.price) || Number(sellPoint?.close) || 0;

      if (buyPrice > 0 && sellPrice > 0) {
        const tradeReturn = (sellPrice - buyPrice) / buyPrice;
        portfolioValue = portfolioValue * (1 + tradeReturn);
        totalTrades += 1;

        if (tradeReturn > 0) {
          wins += 1;
        }

        peakPortfolio = Math.max(peakPortfolio, portfolioValue);
        const currentDrawdown = peakPortfolio > 0 ? (peakPortfolio - portfolioValue) / peakPortfolio : 0;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    }
  }

  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(2)) : 0;
  const totalReturn = Number((((portfolioValue - initialCapital) / initialCapital) * 100).toFixed(2));

  return {
    strategyName: 'MarketPulse Anomaly & Silent Signal Momentum Strategy',
    totalTrades,
    winRate,
    totalReturn,
    maxDrawdown: Number((maxDrawdown * 100).toFixed(2)),
    finalPortfolioValue: Number(portfolioValue.toFixed(2)),
  };
}

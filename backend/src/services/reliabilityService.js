/**
 * Reliability / Data Freshness Service
 *
 * Centralizes market-data freshness classification and
 * graceful failure handling.
 *
 * IMPORTANT:
 * Freshness is based on BOTH:
 * 1. When our backend retrieved the data
 * 2. When the market/exchange generated the data
 *
 * This prevents recently-fetched but already-stale data
 * from being incorrectly presented as fresh.
 */

const THRESHOLDS_MS = {
  live: 15 * 1000,
  recent: 2 * 60 * 1000,
  delayed: 15 * 60 * 1000,
};

function getAgeMs(timestamp) {
  if (!timestamp) {
    return null;
  }

  const time = new Date(timestamp).getTime();

  if (Number.isNaN(time)) {
    return null;
  }

  return Math.max(0, Date.now() - time);
}

/**
 * @param {object} params
 * @param {Date|string|null} params.retrievedAt
 * @param {Date|string|null} params.marketTimestamp
 * @param {string} params.status
 * @returns {'live'|'recent'|'delayed'|'stale'|'unavailable'}
 */
export function classifyFreshness({
  retrievedAt,
  marketTimestamp,
  status,
}) {
  /*
   * Hard failures always win.
   */
  if (
    status === 'unavailable' ||
    status === 'error' ||
    status === 'timeout'
  ) {
    return 'unavailable';
  }

  /*
   * If the market is closed, the latest valid
   * data is naturally not live.
   */
  if (status === 'market_closed') {
    return 'delayed';
  }

  /*
   * We cannot establish freshness without
   * a retrieval timestamp.
   */
  const retrievedAgeMs = getAgeMs(retrievedAt);

  if (retrievedAgeMs === null) {
    return 'unavailable';
  }

  /*
   * If the provider gives us a market timestamp,
   * check that too.
   */
  const marketAgeMs = getAgeMs(marketTimestamp);

  /*
   * Use the OLDEST known timestamp.
   *
   * Example:
   * fetched 5 seconds ago
   * market timestamp is 10 minutes old
   *
   * Result → delayed, not live.
   */
  const effectiveAgeMs =
    marketAgeMs === null
      ? retrievedAgeMs
      : Math.max(retrievedAgeMs, marketAgeMs);

  if (effectiveAgeMs <= THRESHOLDS_MS.live) {
    return 'live';
  }

  if (effectiveAgeMs <= THRESHOLDS_MS.recent) {
    return 'recent';
  }

  if (effectiveAgeMs <= THRESHOLDS_MS.delayed) {
    return 'delayed';
  }

  return 'stale';
}

/**
 * Wraps a market-data fetch attempt so failures
 * degrade gracefully instead of crashing the request.
 *
 * Callers always receive a predictable object shape.
 */
export async function withReliability(fetchFn) {
  try {
    const result = await fetchFn();

    const status = result.status || 'ok';

    return {
      ...result,

      status,

      freshness: classifyFreshness({
        retrievedAt: result.retrievedAt,
        marketTimestamp: result.marketTimestamp,
        status,
      }),
    };
  } catch (err) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ECONNABORTED';

    return {
      status: isTimeout ? 'timeout' : 'error',

      freshness: 'unavailable',

      error:
        err?.message ||
        'Market data request failed',

      retrievedAt: new Date().toISOString(),

      marketTimestamp: null,
    };
  }
}
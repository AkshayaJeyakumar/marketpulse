import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  WatchlistItem,
} from '../types/watchlist';

import {
  FreshnessBadge,
} from './FreshnessBadge';


const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:4000';


type HistoryRange =
  | '1d'
  | '1w'
  | '1m';


interface HistoryPoint {
  timestamp: string;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}


interface HistoryResponse {
  symbol: string;
  name?: string;
  status: string;
  source: string;
  retrievedAt: string;
  marketTimestamp?: string | null;
  yahooSymbol?: string;
  range: HistoryRange;
  interval: string;
  points: HistoryPoint[];
}


function formatPrice(
  value?: number | null
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  return `₹${value.toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}


function formatPercent(
  value?: number | null
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  const sign =
    value > 0
      ? '+'
      : '';

  return `${sign}${value.toFixed(2)}%`;
}


function formatNumber(
  value?: number | null
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  return value.toLocaleString(
    'en-IN'
  );
}


function formatDate(
  value?: string | null
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
  }

  return date.toLocaleString(
    'en-IN',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );
}


function getSignalLabel(
  value: number
) {
  if (value >= 70) {
    return 'High';
  }

  if (value >= 40) {
    return 'Moderate';
  }

  return 'Low';
}


function getSignalColor(
  value: number
) {
  if (value >= 70) {
    return 'var(--negative)';
  }

  if (value >= 40) {
    return 'var(--attention)';
  }

  return 'var(--positive)';
}


function getRangeLabel(
  range: HistoryRange
) {
  if (range === '1d') {
    return '1 Day';
  }

  if (range === '1w') {
    return '1 Week';
  }

  return '1 Month';
}


function getChartTime(
  timestamp: string,
  range: HistoryRange
) {
  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  if (range === '1d') {
    return date.toLocaleTimeString(
      'en-IN',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }

  if (range === '1w') {
    return date.toLocaleString(
      'en-IN',
      {
        weekday: 'short',
        hour: '2-digit',
      }
    );
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
    }
  );
}


function getTooltipTime(
  timestamp: string
) {
  return formatDate(timestamp);
}


interface BacktestResult {
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  finalPortfolioValue: number;
}

export function StockDetail({
  item,
  onBack,
}: {
  item: WatchlistItem;
  onBack: () => void;
}) {

  const [
    range,
    setRange,
  ] = useState<HistoryRange>('1d');


  const [
    history,
    setHistory,
  ] = useState<HistoryResponse | null>(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null);
  const [isLoadingBacktest, setIsLoadingBacktest] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  const fetchBacktest = async () => {
    setIsLoadingBacktest(true);
    setBacktestError(null);

    try {
      const response = await fetch(`${API_BASE}/api/backtest/${encodeURIComponent(item.symbol)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Backtest failed with status ${response.status}`);
      }

      const data = await response.json();
      setBacktestData(data);
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : 'Unable to run strategy backtest.');
    } finally {
      setIsLoadingBacktest(false);
    }
  };



  /*
   * Fetch historical data whenever
   * the selected stock or range changes.
   */
  useEffect(() => {

    let cancelled = false;


    async function loadHistory() {

      setLoading(true);

      setError(null);

      setHistory(null);


      try {

        const response =
          await fetch(
            `${API_BASE}/api/market/history/${encodeURIComponent(
              item.symbol
            )}?range=${range}`,
            {
              cache: 'no-store',
            }
          );


        if (!response.ok) {
          throw new Error(
            `Unable to load historical data (${response.status})`
          );
        }


        const result =
          await response.json();


        if (cancelled) {
          return;
        }


        if (
          result.status !== 'ok' ||
          !Array.isArray(
            result.points
          )
        ) {
          throw new Error(
            'Historical market data is unavailable.'
          );
        }


        setHistory(result);

      } catch (err) {

        if (cancelled) {
          return;
        }


        console.error(
          'Unable to load stock history:',
          err
        );


        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load historical data.'
        );

      } finally {

        if (!cancelled) {
          setLoading(false);
        }

      }

    }


    loadHistory();


    return () => {
      cancelled = true;
    };

  }, [
    item.symbol,
    range,
  ]);


  /*
   * Prepare chart data.
   *
   * Yahoo timestamps are kept intact,
   * while the chart receives a display label.
   */
  const chartData =
    useMemo(() => {
      if (
        !history ||
        !Array.isArray(history.points)
      ) {
        return [];
      }

      return history.points
        .map((point) => ({
          ...point,
          price: Number(point.price),
          timestamp: String(point.timestamp),
          displayTime:
            getChartTime(
              String(point.timestamp),
              range
            ),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.price) &&
            point.price > 0 &&
            Boolean(point.timestamp) &&
            Number.isFinite(
              new Date(point.timestamp).getTime()
            )
        )
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
        );
    }, [
      history,
      range,
    ]);


  const firstPrice =
    chartData.length > 0
      ? Number(chartData[0].price)
      : null;


  const lastPrice =
    chartData.length > 0
      ? Number(
          chartData[
            chartData.length - 1
          ].price
        )
      : null;


  const chartChange =
    firstPrice !== null &&
    lastPrice !== null &&
    firstPrice !== 0
      ? (
          (lastPrice - firstPrice) /
          firstPrice
        ) *
        100
      : null;


  const chartDirection =
    chartChange !== null &&
    chartChange >= 0
      ? 'up'
      : 'down';


  const sinceLastView =
    item.priceChangeSinceLastView;


  const tierLabel =
    item.tier === 'significant'
      ? 'SIGNIFICANT'
      : item.tier === 'worth_watching'
        ? 'WORTH WATCHING'
        : 'NORMAL';


  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor:
          'var(--bg-page)',
        color:
          'var(--text-primary)',
      }}
    >

      <div
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      >

        {/* =====================================================
            BACK
        ====================================================== */}

        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{
            color:
              'var(--text-secondary)',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor =
              'var(--bg-muted)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor =
              'transparent';
          }}
        >
          <span>
            ←
          </span>

          Back to watchlist
        </button>


        {/* =====================================================
            HEADER
        ====================================================== */}

        <div
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor:
              'var(--bg-elevated)',
            borderColor:
              'var(--border)',
            boxShadow:
              'var(--shadow-card)',
          }}
        >

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <div className="flex flex-wrap items-center gap-3">

                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{
                    color:
                      'var(--text-primary)',
                  }}
                >
                  {item.symbol}
                </h1>


                <FreshnessBadge
                  freshness={
                    item.freshness
                  }
                />


                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      item.tier ===
                      'significant'
                        ? 'color-mix(in srgb, var(--negative) 12%, transparent)'
                        : item.tier ===
                            'worth_watching'
                          ? 'color-mix(in srgb, var(--attention) 12%, transparent)'
                          : 'var(--bg-muted)',

                    color:
                      item.tier ===
                      'significant'
                        ? 'var(--negative)'
                        : item.tier ===
                            'worth_watching'
                          ? 'var(--attention)'
                          : 'var(--text-secondary)',
                  }}
                >
                  {tierLabel}
                </span>

                {item.isSilentSignal && (
                  <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 rounded-full px-3 py-1 text-xs font-semibold shrink-0 inline-flex items-center gap-1">
                    🤫 Silent Signal Detected
                  </span>
                )}

              </div>


              <p
                className="mt-1 text-sm"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                {item.name}
              </p>

            </div>


            <div className="text-left sm:text-right">

              <div
                className="text-3xl font-bold"
                style={{
                  color:
                    'var(--text-primary)',
                }}
              >
                {formatPrice(
                  item.price
                )}
              </div>


              <div
                className="mt-1 text-sm font-medium"
                style={{
                  color:
                    item.direction ===
                    'up'
                      ? 'var(--positive)'
                      : 'var(--negative)',
                }}
              >
                {sinceLastView !==
                  null &&
                sinceLastView !==
                  undefined
                  ? `${sinceLastView >= 0 ? '+' : ''}${sinceLastView.toFixed(2)}% since last check`
                  : 'No previous view comparison'}
              </div>

            </div>

          </div>

        </div>


        {/* =====================================================
            CHART
        ====================================================== */}

        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor:
              'var(--bg-elevated)',
            borderColor:
              'var(--border)',
            boxShadow:
              'var(--shadow-card)',
          }}
        >

          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2
                className="text-lg font-semibold"
                style={{
                  color:
                    'var(--text-primary)',
                }}
              >
                Price history
              </h2>


              <p
                className="mt-1 text-sm"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                Historical market observations from Yahoo Finance
              </p>

            </div>


            {/* RANGE BUTTONS */}

            <div
              className="inline-flex w-fit rounded-lg border p-1"
              style={{
                borderColor:
                  'var(--border)',
                backgroundColor:
                  'var(--bg-muted)',
              }}
            >

              {(
                [
                  '1d',
                  '1w',
                  '1m',
                ] as HistoryRange[]
              ).map(
                (option) => (

                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setRange(
                        option
                      )
                    }
                    className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor:
                        range ===
                        option
                          ? 'var(--bg-elevated)'
                          : 'transparent',

                      color:
                        range ===
                        option
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',

                      boxShadow:
                        range ===
                        option
                          ? 'var(--shadow-card)'
                          : 'none',
                    }}
                  >
                    {option.toUpperCase()}
                  </button>

                )
              )}

            </div>

          </div>


          {/* CHART SUMMARY */}

          {!loading &&
            !error &&
            chartData.length >
              0 && (

              <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">

                <div>

                  <div
                    className="text-2xl font-bold"
                    style={{
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    {formatPrice(
                      lastPrice
                    )}
                  </div>

                  <div
                    className="text-xs"
                    style={{
                      color:
                        'var(--text-secondary)',
                    }}
                  >
                    Latest observation
                  </div>

                </div>


                <div>

                  <div
                    className="text-sm font-semibold"
                    style={{
                      color:
                        chartDirection ===
                        'up'
                          ? 'var(--positive)'
                          : 'var(--negative)',
                    }}
                  >
                    {chartChange !==
                    null
                      ? `${chartChange >= 0 ? '+' : ''}${chartChange.toFixed(2)}%`
                      : '—'}
                  </div>

                  <div
                    className="text-xs"
                    style={{
                      color:
                        'var(--text-secondary)',
                    }}
                  >
                    {getRangeLabel(
                      range
                    )}
                  </div>

                </div>

              </div>

            )}

          {!loading &&
            !error &&
            chartData.length ===
              1 && (

              <p
                className="mb-3 text-xs"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                Only one valid market observation is available for this period.
              </p>

            )}


          {/* LOADING */}

          {loading && (

            <div
              className="flex h-80 items-center justify-center rounded-lg"
              style={{
                backgroundColor:
                  'var(--bg-muted)',
              }}
            >
              <div
                className="text-sm"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                Loading price history…
              </div>
            </div>

          )}


          {/* ERROR */}

          {!loading &&
            error && (

              <div
                className="flex h-80 items-center justify-center rounded-lg border px-6 text-center"
                style={{
                  backgroundColor:
                    'var(--bg-muted)',
                  borderColor:
                    'var(--border)',
                }}
              >

                <div>

                  <div
                    className="mb-2 text-sm font-semibold"
                    style={{
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    Historical data unavailable
                  </div>

                  <p
                    className="max-w-md text-sm"
                    style={{
                      color:
                        'var(--text-secondary)',
                    }}
                  >
                    {error}
                  </p>

                </div>

              </div>

            )}


          {/* EMPTY */}

          {!loading &&
            !error &&
            chartData.length ===
              0 && (

              <div
                className="flex h-80 items-center justify-center rounded-lg"
                style={{
                  backgroundColor:
                    'var(--bg-muted)',
                }}
              >
                <div
                  className="text-sm"
                  style={{
                    color:
                      'var(--text-secondary)',
                  }}
                >
                  No historical observations are available for this range.
                </div>
              </div>

            )}


          {/* REAL CHART */}

          {!loading &&
            !error &&
            chartData.length >
              0 && (

              <div className="h-80 w-full">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <LineChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 0,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />


                    <XAxis
                      dataKey="displayTime"
                      tick={{
                        fill:
                          'var(--text-secondary)',
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={{
                        stroke:
                          'var(--border)',
                      }}
                      minTickGap={35}
                    />


                    <YAxis
                      domain={[
                        'auto',
                        'auto',
                      ]}
                      tick={{
                        fill:
                          'var(--text-secondary)',
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={false}
                      width={65}
                      tickFormatter={(value) =>
                        `₹${Number(
                          value
                        ).toFixed(0)}`
                      }
                    />


                    <Tooltip
                      contentStyle={{
                        backgroundColor:
                          'var(--bg-elevated)',
                        borderColor:
                          'var(--border)',
                        borderRadius:
                          '10px',
                        boxShadow:
                          'var(--shadow-card)',
                      }}
                      labelStyle={{
                        color:
                          'var(--text-primary)',
                      }}
                      itemStyle={{
                        color:
                          'var(--text-primary)',
                      }}
                      labelFormatter={(
                        _label,
                        payload
                      ) => {

                        const timestamp =
                          payload?.[0]
                            ?.payload
                            ?.timestamp;

                        return timestamp
                          ? getTooltipTime(
                              timestamp
                            )
                          : '';
                      }}
                      formatter={(
                        value
                      ) => [
                        formatPrice(
                          Number(value)
                        ),
                        'Price',
                      ]}
                    />


                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="var(--positive)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{
                        r: 4,
                      }}
                      connectNulls
                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>

            )}


          {/* TRANSPARENCY */}

          {history && (

            <div
              className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs"
              style={{
                color:
                  'var(--text-secondary)',
              }}
            >

              <span>
                Source: {history.source}
              </span>

              <span>
                Interval: {history.interval}
              </span>

              {history.yahooSymbol && (
                <span>
                  Yahoo symbol: {history.yahooSymbol}
                </span>
              )}

              <span>
                Retrieved: {formatDate(
                  history.retrievedAt
                )}
              </span>

            </div>

          )}

        </section>


        {/* =====================================================
            METRICS & STATISTICAL ANALYSIS
        ====================================================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <MetricCard
            label="Previous close"
            value={formatPrice(
              item.prevClose
            )}
          />


          <MetricCard
            label="Current volume"
            value={formatNumber(
              item.volume
            )}
          />


          <MetricCard
            label="Volume change"
            value={formatPercent(
              item.volumeChangeSinceLastView
            )}
          />

        </div>

        {/* Statistical Metrics Grid */}
        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Statistical Metrics (20-Day Baseline)
              </h2>
              <p
                className="mt-0.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Rolling mathematical indicators computed against 20-day benchmark history.
              </p>
            </div>
            {item.anomalyStatus && (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-md border"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                Status: {item.anomalyStatus}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
              <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Return Z-Score</div>
              <div className="mt-1 text-base font-bold tabular-nums" style={{ color: item.returnZScore && Math.abs(item.returnZScore) >= 2.5 ? 'var(--negative)' : 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>
                {item.returnZScore != null ? `${item.returnZScore.toFixed(2)}σ` : 'N/A'}
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
              <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Volume Z-Score</div>
              <div className="mt-1 text-base font-bold tabular-nums" style={{ color: item.volumeZScore && item.volumeZScore >= 3.0 ? 'var(--negative)' : 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>
                {item.volumeZScore != null ? `${item.volumeZScore.toFixed(2)}σ` : 'N/A'}
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
              <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Volume Ratio</div>
              <div className="mt-1 text-base font-bold tabular-nums" style={{ color: item.volumeRatio && item.volumeRatio >= 2.0 ? 'var(--attention)' : 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>
                {item.volumeRatio != null ? `${item.volumeRatio.toFixed(2)}x` : 'N/A'}
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
              <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Volatility Z-Score</div>
              <div className="mt-1 text-base font-bold tabular-nums" style={{ color: item.volatilityZScore && item.volatilityZScore >= 2.5 ? 'var(--negative)' : 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>
                {item.volatilityZScore != null ? `${item.volatilityZScore.toFixed(2)}σ` : 'N/A'}
              </div>
            </div>
          </div>
        </section>

        {/* Movement Attribution Section (CAPM Beta) */}
        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="mb-4">
            <h2
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Movement Attribution (60-Day Beta)
            </h2>
            <p
              className="mt-0.5 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Decomposition of stock return into market-driven (NIFTY 50) vs. stock-specific movement.
            </p>
          </div>

          {item.attributionStatus === 'insufficient_data' || item.marketSharePct == null || item.stockSharePct == null ? (
            <div className="rounded-lg p-4 text-sm border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
              Not enough historical data (requires 60 trading days) to calculate market attribution.
            </div>
          ) : (
            <div>
              {/* Dual Progress Bar */}
              <div
                className="w-full h-4 rounded-full overflow-hidden flex"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.marketSharePct))}%`,
                    backgroundColor: 'var(--brand, #3b82f6)',
                  }}
                  title={`Market-Driven: ${item.marketSharePct}%`}
                />
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.stockSharePct))}%`,
                    backgroundColor: 'var(--positive, #10b981)',
                  }}
                  title={`Stock-Specific: ${item.stockSharePct}%`}
                />
              </div>

              {/* Labels */}
              <div className="mt-3 flex items-center justify-between text-xs sm:text-sm font-medium">
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--brand, #3b82f6)' }} />
                  <span>🌍 Market-Driven: <span className="font-bold tabular-nums">{item.marketSharePct}%</span></span>
                </div>

                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--positive, #10b981)' }} />
                  <span>🏢 Stock-Specific: <span className="font-bold tabular-nums">{item.stockSharePct}%</span></span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Strategy Simulation (Backtest) */}
        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Strategy Simulation (Backtest)
              </h2>
              <p
                className="mt-0.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Historical performance simulation of 5-day holding momentum strategy on anomaly triggers.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchBacktest}
              disabled={isLoadingBacktest}
              className="px-4 py-2 text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0 border"
              style={{
                backgroundColor: 'var(--brand)',
                color: '#ffffff',
                borderColor: 'var(--brand-strong)',
              }}
            >
              {isLoadingBacktest ? 'Running Backtest...' : 'Run Silent Signal 5-Day Hold Backtest'}
            </button>
          </div>

          {backtestError && (
            <div className="p-3 text-xs rounded-lg border text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-900/40">
              {backtestError}
            </div>
          )}

          {backtestData && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold mb-3 text-tertiary" style={{ color: 'var(--text-tertiary)' }}>
                STRATEGY PERFORMANCE RESULTS: {backtestData.strategyName}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Trades */}
                <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                  <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Total Trades</div>
                  <div className="mt-1 text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>
                    {backtestData.totalTrades}
                  </div>
                </div>

                {/* Win Rate */}
                <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                  <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Win Rate</div>
                  <div
                    className="mt-1 text-base font-bold tabular-nums"
                    style={{
                      color: backtestData.winRate >= 50 ? 'var(--positive)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-data)',
                    }}
                  >
                    {backtestData.winRate}%
                  </div>
                </div>

                {/* Total Return */}
                <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                  <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Total Return</div>
                  <div
                    className="mt-1 text-base font-bold tabular-nums"
                    style={{
                      color: backtestData.totalReturn >= 0 ? 'var(--positive)' : 'var(--negative)',
                      fontFamily: 'var(--font-data)',
                    }}
                  >
                    {backtestData.totalReturn >= 0 ? '+' : ''}{backtestData.totalReturn}%
                  </div>
                </div>

                {/* Max Drawdown */}
                <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                  <div className="text-xs text-tertiary" style={{ color: 'var(--text-tertiary)' }}>Max Drawdown</div>
                  <div
                    className="mt-1 text-base font-bold tabular-nums"
                    style={{
                      color: 'var(--negative)',
                      fontFamily: 'var(--font-data)',
                    }}
                  >
                    {backtestData.maxDrawdown}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Silent Signal Observation Card */}
        {item.isSilentSignal && (
          <section className="mb-6 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/40 p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🤫</span>
              <div>
                <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                  Silent Signal Observation
                </h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  MarketPulse observed significantly elevated trading volume ({item.volumeRatio?.toFixed(2)}x baseline) accompanied by minimal price movement (&lt;0.5%). This price-volume divergence indicates potential institutional volume absorption, block trading activity, or baseline market accumulation/distribution, warranting close investigation.
                </p>
              </div>
            </div>
          </section>
        )}


        {/* =====================================================
            ATTENTION
        ====================================================== */}

        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor:
              'var(--bg-elevated)',
            borderColor:
              'var(--border)',
            boxShadow:
              'var(--shadow-card)',
          }}
        >

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2
                className="text-lg font-semibold"
                style={{
                  color:
                    'var(--text-primary)',
                }}
              >
                Attention score
              </h2>

              <p
                className="mt-1 text-sm"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                How strongly the current market activity stands out.
              </p>

            </div>


            <div
              className="text-3xl font-bold"
              style={{
                color:
                  item.attentionScore >=
                  60
                    ? 'var(--negative)'
                    : item.attentionScore >=
                        25
                      ? 'var(--attention)'
                      : 'var(--text-primary)',
              }}
            >
              {Math.round(
                item.attentionScore
              )}
            </div>

          </div>


          <div
            className="mt-4 h-2 overflow-hidden rounded-full"
            style={{
              backgroundColor:
                'var(--bg-muted)',
            }}
          >

            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    item.attentionScore
                  )
                )}%`,

                backgroundColor:
                  item.attentionScore >=
                  60
                    ? 'var(--negative)'
                    : item.attentionScore >=
                        25
                      ? 'var(--attention)'
                      : 'var(--neutral-tier)',
              }}
            />

          </div>

        </section>


        {/* =====================================================
            SIGNALS
        ====================================================== */}

        {item.signals && (

          <section
            className="mb-6 rounded-xl border p-5 sm:p-6"
            style={{
              backgroundColor:
                'var(--bg-elevated)',
              borderColor:
                'var(--border)',
              boxShadow:
                'var(--shadow-card)',
            }}
          >

            <h2
              className="text-lg font-semibold"
              style={{
                color:
                  'var(--text-primary)',
              }}
            >
              What drove the attention score?
            </h2>


            <p
              className="mt-1 text-sm"
              style={{
                color:
                  'var(--text-secondary)',
              }}
            >
              The score combines observable price, volume and volatility changes.
            </p>


            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

              <SignalCard
                label="Price movement"
                value={
                  item.signals
                    .priceSignal
                }
              />


              <SignalCard
                label="Trading volume"
                value={
                  item.signals
                    .volumeSignal
                }
              />


              <SignalCard
                label="Volatility"
                value={
                  item.signals
                    .volatilitySignal
                }
              />

            </div>

          </section>

        )}


        {/* =====================================================
            WHY DID IT CHANGE?
        ====================================================== */}

        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor:
              'var(--bg-elevated)',
            borderColor:
              'var(--border)',
            boxShadow:
              'var(--shadow-card)',
          }}
        >

          <h2
            className="text-lg font-semibold"
            style={{
              color:
                'var(--text-primary)',
            }}
          >
            Why did it change?
          </h2>


          {item.reasons &&
            item.reasons.length >
              0 && (

              <ul
                className="mt-4 space-y-2"
              >

                {item.reasons.map(
                  (reason, index) => (

                    <li
                      key={`${reason}-${index}`}
                      className="flex gap-3 text-sm"
                      style={{
                        color:
                          'var(--text-secondary)',
                      }}
                    >

                      <span
                        aria-hidden="true"
                        style={{
                          color:
                            'var(--accent)',
                        }}
                      >
                        •
                      </span>

                      <span>
                        {reason}
                      </span>

                    </li>

                  )
                )}

              </ul>

            )}


          {item.explanation && (

            <div
              className="mt-5 rounded-lg border p-4"
              style={{
                backgroundColor:
                  'var(--bg-muted)',
                borderColor:
                  'var(--border)',
              }}
            >

              <p
                className="text-sm leading-6"
                style={{
                  color:
                    'var(--text-primary)',
                }}
              >
                {item.explanation}
              </p>

            </div>

          )}


          {item.explanationDisclaimer && (

            <p
              className="mt-4 text-xs leading-5"
              style={{
                color:
                  'var(--text-secondary)',
              }}
            >
              {item.explanationDisclaimer}
            </p>

          )}

        </section>


        {/* =====================================================
            DATA TRANSPARENCY
        ====================================================== */}

        <section
          className="rounded-xl border p-5 sm:p-6"
          style={{
            backgroundColor:
              'var(--bg-elevated)',
            borderColor:
              'var(--border)',
            boxShadow:
              'var(--shadow-card)',
          }}
        >

          <h2
            className="text-lg font-semibold"
            style={{
              color:
                'var(--text-primary)',
            }}
          >
            Data transparency
          </h2>


          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">

            <InfoRow
              label="Source"
              value={
                item.source ||
                'Unknown'
              }
            />


            <InfoRow
              label="Market timestamp"
              value={formatDate(
                item.marketTimestamp
              )}
            />


            <InfoRow
              label="Retrieved"
              value={formatDate(
                item.retrievedAt
              )}
            />


            <InfoRow
              label="Last viewed"
              value={formatDate(
                item.lastViewedAt
              )}
            />

          </div>


          <p
            className="mt-5 text-xs leading-5"
            style={{
              color:
                'var(--text-secondary)',
            }}
          >
            MarketPulse reports observed market activity.
            Historical observations may be delayed depending
            on the data provider. This is not investment advice
            or a prediction.
          </p>

        </section>

      </div>

    </div>
  );
}


/* =============================================================
   REUSABLE COMPONENTS
============================================================= */


function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor:
          'var(--bg-elevated)',
        borderColor:
          'var(--border)',
        boxShadow:
          'var(--shadow-card)',
      }}
    >

      <div
        className="text-xs font-medium uppercase tracking-wide"
        style={{
          color:
            'var(--text-secondary)',
        }}
      >
        {label}
      </div>


      <div
        className="mt-2 text-xl font-bold"
        style={{
          color:
            'var(--text-primary)',
        }}
      >
        {value}
      </div>

    </div>
  );
}


function SignalCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor:
          'var(--bg-muted)',
        borderColor:
          'var(--border)',
      }}
    >

      <div className="flex items-center justify-between gap-3">

        <span
          className="text-sm font-medium"
          style={{
            color:
              'var(--text-primary)',
          }}
        >
          {label}
        </span>


        <span
          className="text-sm font-semibold"
          style={{
            color:
              getSignalColor(value),
          }}
        >
          {getSignalLabel(value)}
        </span>

      </div>


      <div
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{
          backgroundColor:
            'var(--bg-elevated)',
        }}
      >

        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(
              100,
              Math.max(
                0,
                value
              )
            )}%`,

            backgroundColor:
              getSignalColor(value),
          }}
        />

      </div>


      <div
        className="mt-2 text-xs"
        style={{
          color:
            'var(--text-secondary)',
        }}
      >
        Score: {Math.round(value)}
      </div>

    </div>
  );
}


function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor:
          'var(--bg-muted)',
        borderColor:
          'var(--border)',
      }}
    >

      <div
        className="text-xs font-medium uppercase tracking-wide"
        style={{
          color:
            'var(--text-secondary)',
        }}
      >
        {label}
      </div>


      <div
        className="mt-1 break-words text-sm font-medium"
        style={{
          color:
            'var(--text-primary)',
        }}
      >
        {value}
      </div>

    </div>
  );
}
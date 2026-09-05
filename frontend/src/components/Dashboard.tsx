import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { WatchlistItem } from '../types/watchlist';

import { useWatchlist } from '../hooks/useWatchlist';
import { useRecommendations } from '../hooks/useRecommendations';
import { StockCard } from './StockCard';
import { StockRow } from './StockRow';
import { StockDetail } from './StockDetail';
import { TierSection } from './TierSection';

import {
  LoadingState,
  ErrorState,
  EmptyWatchlistState,
} from './StatusStates';

import { AddStockModal } from './AddStockModal';
import { ConfirmationModal } from './ConfirmationModal';
import { RecommendationSection } from './RecommendationSection';
import type { AuthUser } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import type { WatchlistRecommendation } from '../types/watchlist';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:4000';

const TABLE_GRID =
  'minmax(180px, 2fr) 110px 100px 80px 120px 70px 90px';


function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString(
    'en-IN',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}


function formatLastChecked(iso: string) {
  return new Date(iso).toLocaleString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}


export function Dashboard({
  watchlistSearch,
  user,
}: {
  watchlistSearch: string;
  user: AuthUser;
}) {
  const { authFetch } = useAuth();

  const {
    data,
    status,
    reload,
    acknowledgeView,
  } = useWatchlist();

  const {
    items: recommendations,
    status: recommendationStatus,
    reload: reloadRecommendations,
  } = useRecommendations();


  const [showAddStock, setShowAddStock] =
    useState(false);

  const [pendingRemoval, setPendingRemoval] =
    useState<string | null>(null);

  const [removingSymbol, setRemovingSymbol] =
    useState<string | null>(null);

  const [removeError, setRemoveError] =
    useState<string | null>(null);

  const [addingRecommendation, setAddingRecommendation] =
    useState<string | null>(null);
  const [recommendationError, setRecommendationError] =
    useState<string | null>(null);
  
  /*
   * Selected stock for Stock Detail page.
   */
  const [selectedStock, setSelectedStock] =
    useState<WatchlistItem | null>(null);
  
  const filteredItems = useMemo(() => {
    const query = watchlistSearch.trim().toLowerCase();
  
    if (!data || !query) {
      return data?.items ?? [];
    }
  
    return data.items.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
  }, [data, watchlistSearch]);
  
  const filteredSummary = useMemo(() => ({
    significant: filteredItems.filter(
      (item) => item.tier === 'significant'
    ).length,
    worthWatching: filteredItems.filter(
      (item) => item.tier === 'worth_watching'
    ).length,
    normal: filteredItems.filter(
      (item) => item.tier === 'normal'
    ).length,
  }), [filteredItems]);
  
  const acknowledgedViewRef =
    useRef<string | null>(null);


  /*
   * Keeps us from acknowledging the same
   * dashboard response multiple times.
   */

  /*
   * Once the watchlist has successfully
   * loaded, acknowledge the view.
   *
   * GET current data
   *      ↓
   * Dashboard renders
   *      ↓
   * POST /api/watchlist/view
   *      ↓
   * Current state becomes the baseline
   * for the next visit.
   */
  useEffect(() => {

    if (
      status !== 'ready' ||
      !data ||
      data.items.length === 0
    ) {
      return;
    }

    if (
      acknowledgedViewRef.current ===
      data.generatedAt
    ) {
      return;
    }

    acknowledgedViewRef.current =
      data.generatedAt;

    acknowledgeView();

  }, [
    status,
    data,
    acknowledgeView,
  ]);


  /*
   * Remove stock from watchlist.
   */
  function requestRemoveStock(symbol: string) {
    setRemoveError(null);
    setPendingRemoval(symbol);
  }

  const cancelRemove = useCallback(() => {
    if (removingSymbol) {
      return;
    }

    setPendingRemoval(null);
    setRemoveError(null);
  }, [removingSymbol]);

  async function handleRemoveStock() {
    if (!pendingRemoval || removingSymbol) {
      return;
    }

    const symbol = pendingRemoval;
    setRemovingSymbol(symbol);
    setRemoveError(null);

    try {

      const response = await authFetch(
        `${API_BASE}/api/watchlist/stocks/${encodeURIComponent(
          symbol
        )}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {

        const result = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          result.error ||
            'Unable to remove stock'
        );
      }

      /*
       * If the removed stock was open
       * in StockDetail, go back.
       */
      setSelectedStock(null);

      await reload();

      setPendingRemoval(null);

    } catch (error) {
      setRemoveError(
        error instanceof Error
          ? error.message
          : 'Unable to remove stock'
      );

    } finally {
      setRemovingSymbol(null);

    }
  }

  async function addRecommendation(item: WatchlistRecommendation) {
    setAddingRecommendation(item.symbol);
    setRecommendationError(null);

    try {
      const response = await authFetch(
        `${API_BASE}/api/watchlist/stocks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: item.symbol,
            name: item.name,
            exchange: item.exchange,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || 'Unable to add suggested stock'
        );
      }

      await Promise.all([
        reload(),
        reloadRecommendations(),
      ]);
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : 'Unable to add suggested stock'
      );
    } finally {
      setAddingRecommendation(null);
    }
  }

  async function dismissRecommendation(item: WatchlistRecommendation) {
    setRecommendationError(null);

    try {
      const response = await authFetch(
        `${API_BASE}/api/recommendations/watchlist/${encodeURIComponent(
          item.symbol
        )}/not-interested`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.error || 'Unable to update suggestions'
        );
      }

      await reloadRecommendations();
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : 'Unable to update suggestions'
      );
    }
  }


  /*
   * Summary counts.
   */
  const significant =
    filteredSummary.significant;

  const worthWatching =
    filteredSummary.worthWatching;

  const normal =
    filteredSummary.normal;


  /*
   * Previous view timestamps.
   */
  const previousViews =
    filteredItems
      .map(
        (item) =>
          item.lastViewedAt
      )
      .filter(
        (value): value is string =>
          Boolean(value)
      ) ?? [];


  const lastChecked =
    previousViews.length > 0
      ? previousViews.reduce(
          (latest, current) =>
            new Date(current) >
            new Date(latest)
              ? current
              : latest
        )
      : null;


  /*
   * Meaningful changes.
   */
  const meaningfulChanges =
    filteredItems.filter(
      (item) =>
        item.tier === 'significant' ||
        item.tier ===
          'worth_watching'
    ) ?? [];


  /*
   * Biggest meaningful price change.
   */
  const topChange = [
    ...meaningfulChanges,
  ].sort(
    (a, b) =>
      Math.abs(
        b.priceChangeSinceLastView ??
          0
      ) -
      Math.abs(
        a.priceChangeSinceLastView ??
          0
      )
  )[0];


  /*
   * =========================================
   * STOCK DETAIL PAGE
   * =========================================
   *
   * Whenever selectedStock contains a stock,
   * show StockDetail instead of dashboard.
   */
  if (selectedStock) {

    return (
      <StockDetail
        item={selectedStock}
        onBack={() =>
          setSelectedStock(null)
        }
      />
    );

  }


  return (
    <main className="max-w-5xl mx-auto px-6 py-8">

      {/* =====================================
          HEADER
          ===================================== */}

      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">

        <div>

          <h1
            className="text-2xl font-semibold"
            style={{
              color:
                'var(--text-primary)',
            }}
          >
            What changed since you
            last checked?
          </h1>

          <p
            className="text-sm mt-1 max-w-2xl"
            style={{
              color:
                'var(--text-secondary)',
            }}
          >
            Welcome back, {user.displayName}.{' '}
            MarketPulse ranks unusual
            activity so you can focus on
            what deserves attention — not
            just what moved.
          </p>

        </div>


        <div className="flex items-center gap-3">

          {data && (
            <span
              className="text-xs"
              style={{
                color:
                  'var(--text-tertiary)',
              }}
            >
              Updated{' '}
              {formatTimestamp(
                data.generatedAt
              )}
            </span>
          )}


          <button
            type="button"
            onClick={() =>
              setShowAddStock(true)
            }
            className="px-3 py-2 rounded-lg text-sm font-medium border"
            style={{
              borderColor:
                'var(--border-strong)',
              color:
                'var(--text-primary)',
              backgroundColor:
                'var(--bg-elevated)',
            }}
          >
            + Add stock
          </button>

        </div>

      </div>


      {/* =====================================
          SINCE LAST CHECKED
          ===================================== */}

      {status === 'ready' &&
        data &&
        filteredItems.length > 0 && (

          <div
            className="mb-5 rounded-xl border p-4"
            style={{
              backgroundColor:
                'var(--bg-elevated)',
              borderColor:
                'var(--border)',
            }}
          >

            <div className="flex items-center justify-between gap-4 flex-wrap">

              <div>

                <div
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{
                    color:
                      'var(--text-tertiary)',
                  }}
                >
                  Last checked
                </div>

                <div
                  className="mt-1 text-sm font-medium"
                  style={{
                    color:
                      'var(--text-primary)',
                  }}
                >
                  {lastChecked
                    ? formatLastChecked(
                        lastChecked
                      )
                    : 'First visit'}
                </div>

              </div>


              <div className="flex items-center gap-4">

                <div>

                  <div
                    className="text-xs"
                    style={{
                      color:
                        'var(--text-tertiary)',
                    }}
                  >
                    Since then
                  </div>

                  <div
                    className="mt-1 text-sm font-semibold"
                    style={{
                      color:
                        meaningfulChanges.length >
                        0
                          ? 'var(--attention)'
                          : 'var(--text-primary)',
                    }}
                  >
                    {meaningfulChanges.length ===
                    0
                      ? 'No meaningful changes'
                      : `${meaningfulChanges.length} meaningful ${
                          meaningfulChanges.length ===
                          1
                            ? 'change'
                            : 'changes'
                        }`}
                  </div>

                </div>


                {topChange && (

                  <div
                    className="rounded-lg px-3 py-2"
                    style={{
                      backgroundColor:
                        'var(--bg-subtle)',
                    }}
                  >

                    <div
                      className="text-xs font-semibold"
                      style={{
                        color:
                          'var(--text-primary)',
                      }}
                    >
                      {topChange.symbol}
                    </div>

                    <div
                      className="text-xs font-medium tabular-nums"
                      style={{
                        color:
                          (topChange.priceChangeSinceLastView ??
                            0) >= 0
                            ? 'var(--positive)'
                            : 'var(--negative)',

                        fontFamily:
                          'var(--font-data)',
                      }}
                    >
                      {(topChange.priceChangeSinceLastView ??
                        0) >= 0
                        ? '+'
                        : ''}

                      {(
                        topChange.priceChangeSinceLastView ??
                        0
                      ).toFixed(2)}

                      %
                    </div>

                  </div>

                )}

              </div>

            </div>

          </div>

        )}


      {/* =====================================
          ATTENTION SUMMARY
          ===================================== */}

      {status === 'ready' &&
        data &&
        filteredItems.length > 0 && (

          <div
            className="mb-7 rounded-xl border p-4"
            style={{
              backgroundColor:
                'var(--bg-elevated)',
              borderColor:
                'var(--border)',
            }}
          >

            <div className="flex items-center justify-between gap-4 flex-wrap">

              <div>

                <div
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{
                    color:
                      'var(--text-tertiary)',
                  }}
                >
                  Attention summary
                </div>

                <div
                  className="mt-1 text-sm"
                  style={{
                    color:
                      'var(--text-secondary)',
                  }}
                >
                  Your watchlist is ranked by
                  how unusual the activity is.
                </div>

              </div>


              <div className="flex items-center gap-4 text-sm">

                {/* Significant */}

                <div className="flex items-center gap-1.5">

                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        'var(--negative)',
                    }}
                  />

                  <span
                    style={{
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    {significant}
                  </span>

                  <span
                    style={{
                      color:
                        'var(--text-tertiary)',
                    }}
                  >
                    significant
                  </span>

                </div>


                {/* Worth watching */}

                <div className="flex items-center gap-1.5">

                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        'var(--attention)',
                    }}
                  />

                  <span
                    style={{
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    {worthWatching}
                  </span>

                  <span
                    style={{
                      color:
                        'var(--text-tertiary)',
                    }}
                  >
                    worth watching
                  </span>

                </div>


                {/* Normal */}

                <div className="flex items-center gap-1.5">

                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        'var(--neutral-tier)',
                    }}
                  />

                  <span
                    style={{
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    {normal}
                  </span>

                  <span
                    style={{
                      color:
                        'var(--text-tertiary)',
                    }}
                  >
                    normal
                  </span>

                </div>

              </div>

            </div>

          </div>

        )}


      {/* =====================================
          LOADING
          ===================================== */}

      {status === 'loading' && (
        <LoadingState />
      )}


      {/* =====================================
          ERROR
          ===================================== */}

      {status === 'error' && (
        <ErrorState onRetry={reload} />
      )}


      {/* =====================================
          EMPTY
          ===================================== */}

      {status === 'ready' &&
        data &&
        data.items.length === 0 && (
          <EmptyWatchlistState
            onAddStock={() =>
              setShowAddStock(true)
            }
          />
        )}

      {status === 'ready' &&
        data &&
        data.items.length > 0 &&
        filteredItems.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              No watchlist items match your search.
            </p>
          </div>
        )}


      {/* =====================================
          WATCHLIST
          ===================================== */}

      {status === 'ready' &&
        data &&
        filteredItems.length > 0 && (

          <>

            {/* =================================
                SIGNIFICANT
                ================================= */}

            <TierSection
              tier="significant"
              count={
                filteredSummary.significant
              }
            >

              <div className="grid gap-4 sm:grid-cols-2">

                {filteredItems
                  .filter(
                    (item) =>
                      item.tier ===
                      'significant'
                  )
                  .map((item) => (

                    <StockCard
                      key={item.symbol}
                      item={item}
                      size="large"
                      onClick={
                        setSelectedStock
                      }
                      onRemove={
                        requestRemoveStock
                      }
                    />

                  ))}

              </div>

            </TierSection>


            {/* =================================
                WORTH WATCHING
                ================================= */}

            <TierSection
              tier="worth_watching"
              count={
                filteredSummary.worthWatching
              }
            >

              <div className="grid gap-3 sm:grid-cols-3">

                {filteredItems
                  .filter(
                    (item) =>
                      item.tier ===
                      'worth_watching'
                  )
                  .map((item) => (

                    <StockCard
                      key={item.symbol}
                      item={item}
                      size="medium"
                      onClick={
                        setSelectedStock
                      }
                      onRemove={
                        requestRemoveStock
                      }
                    />

                  ))}

              </div>

            </TierSection>


            {/* =================================
                NORMAL
                ================================= */}

            <TierSection
              tier="normal"
              count={filteredSummary.normal}
            >

              <div
                className="rounded-xl border overflow-x-auto"
                style={{
                  borderColor:
                    'var(--border)',
                  backgroundColor:
                    'var(--bg-elevated)',
                }}
              >

                <div
                  style={{
                    minWidth: '850px',
                  }}
                >

                  {/* Table header */}

                  <div
                    className="grid items-center gap-3 px-4 py-3 text-xs font-medium border-b"
                    style={{
                      gridTemplateColumns:
                        TABLE_GRID,

                      color:
                        'var(--text-tertiary)',

                      borderColor:
                        'var(--border)',
                    }}
                  >

                    <span>
                      Stock
                    </span>

                    <span className="text-right">
                      Price
                    </span>

                    <span className="text-right">
                      Change
                    </span>

                    <span className="text-right">
                      Score
                    </span>

                    <span className="text-right">
                      Data
                    </span>

                    <span className="text-right">
                      Why
                    </span>

                    <span className="text-right">
                      Remove
                    </span>

                  </div>


                  {/* =================================
                      CLICKABLE NORMAL STOCK ROWS
                      ================================= */}

                  {filteredItems
                    .filter(
                      (item) =>
                        item.tier ===
                        'normal'
                    )
                    .map((item) => (

                      <div
                        key={item.symbol}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {

                          /*
                           * IMPORTANT:
                           * If the user clicked a button
                           * such as Remove, don't open
                           * StockDetail.
                           */
                          const target =
                            event.target as HTMLElement;

                          if (
                            target.closest('button')
                          ) {
                            return;
                          }

                          setSelectedStock(item);
                        }}
                        onKeyDown={(event) => {

                          if (
                            event.key ===
                              'Enter' ||
                            event.key === ' '
                          ) {

                            event.preventDefault();

                            setSelectedStock(item);
                          }

                        }}
                        style={{
                          cursor:
                            'pointer',
                        }}
                      >

                        <StockRow
                          item={item}
                          onRemove={
                            requestRemoveStock
                          }
                        />

                      </div>

                    ))}

                </div>

              </div>

            </TierSection>


            {/* =================================
                TRANSPARENCY
                ================================= */}

            <div
              className="mt-6 text-center text-[11px]"
              style={{
                color:
                  'var(--text-tertiary)',
              }}
            >
              {filteredItems.some(
                (item) =>
                  item.source ===
                  'demo-replay'
              )
                ? 'DEMO REPLAY · Market movements are simulated for demonstration. No investment advice or predictions.'
                : 'Market data is ranked by unusual activity. No investment advice or predictions.'}
            </div>

          </>

        )}


      <RecommendationSection
        items={recommendations}
        status={recommendationStatus}
        hasWatchlist={Boolean(data && data.items.length > 0)}
        addingSymbol={addingRecommendation}
        error={recommendationError}
        onAdd={addRecommendation}
        onNotInterested={dismissRecommendation}
        onAddStock={() => setShowAddStock(true)}
      />


      {/* =====================================
          ADD STOCK MODAL
          ===================================== */}

      {showAddStock &&
        data && (

          <AddStockModal
            existingSymbols={data.items.map(
              (item) => item.symbol
            )}

            onClose={() =>
              setShowAddStock(false)
            }

            onAdded={() => {
              setShowAddStock(false);
              reload();
            }}
          />

        )}

      {pendingRemoval && (
        <ConfirmationModal
          symbol={pendingRemoval}
          busy={removingSymbol === pendingRemoval}
          error={removeError}
          onCancel={cancelRemove}
          onConfirm={handleRemoveStock}
        />
      )}

    </main>
  );
}
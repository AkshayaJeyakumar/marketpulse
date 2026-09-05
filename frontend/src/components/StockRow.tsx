import { useState } from 'react';
import type { WatchlistItem } from '../types/watchlist';
import { FreshnessBadge } from './FreshnessBadge';

function formatPrice(price?: number) {
  if (price === undefined) {
    return '—';
  }

  return price.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

function pctChange(
  price?: number,
  prevClose?: number
) {
  if (
    price === undefined ||
    prevClose === undefined ||
    prevClose === 0
  ) {
    return null;
  }

  return (
    ((price - prevClose) /
      prevClose) *
    100
  );
}

const TABLE_GRID =
  'minmax(180px, 2fr) 110px 100px 80px 120px 70px 90px';

const TIER_ACCENT: Record<
  string,
  string
> = {
  significant: 'var(--negative)',
  worth_watching: 'var(--attention)',
  normal: 'var(--neutral-tier)',
};

export function StockRow({
  item,
  onRemove,
}: {
  item: WatchlistItem;
  onRemove?: (symbol: string) => void;
}) {
  const [showWhy, setShowWhy] =
    useState(false);

  const change = pctChange(
    item.price,
    item.prevClose
  );

  const isDown =
    item.direction === 'down';

  const accent =
    TIER_ACCENT[item.tier] ||
    'var(--neutral-tier)';

  return (
    <div
      className="border-b last:border-b-0"
      style={{
        borderColor: 'var(--border)',
      }}
    >

      {/* Main row */}
      <div
        className="grid items-center gap-3 px-4 py-3 text-sm"
        style={{
          gridTemplateColumns:
            TABLE_GRID,
        }}
      >

        {/* Stock */}
        <div className="min-w-0">

          <div
            className="font-medium truncate"
            style={{
              color:
                'var(--text-primary)',
            }}
          >
            {item.symbol}
          </div>

          <div
            className="text-xs truncate mt-0.5"
            style={{
              color:
                'var(--text-tertiary)',
            }}
          >
            {item.name}
          </div>

        </div>


        {/* Price */}
        <div
          className="text-right whitespace-nowrap"
          style={{
            color:
              'var(--text-primary)',
          }}
        >
          {formatPrice(item.price)}
        </div>


        {/* Change */}
        <div
          className="text-right whitespace-nowrap"
          style={{
            color:
              change === null
                ? 'var(--text-tertiary)'
                : isDown
                  ? 'var(--negative)'
                  : 'var(--positive)',
          }}
        >
          {change === null
            ? '—'
            : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
        </div>


        {/* Score */}
        <div
          className="text-right"
          style={{
            color:
              'var(--text-primary)',
          }}
        >
          {item.attentionScore}
        </div>


        {/* Freshness */}
        <div className="flex justify-end">
          <FreshnessBadge
            freshness={
              item.freshness
            }
          />
        </div>


        {/* Why button */}
        <div className="flex justify-end">

          <button
            type="button"
            onClick={() =>
              setShowWhy(
                (value) => !value
              )
            }
            className="px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap transition-opacity hover:opacity-80"
            style={{
              borderColor:
                showWhy
                  ? accent
                  : 'var(--border-strong)',
              color:
                showWhy
                  ? accent
                  : 'var(--text-secondary)',
              backgroundColor:
                'var(--bg-subtle)',
            }}
          >
            {showWhy
              ? 'Hide'
              : 'Why?'}
          </button>

        </div>


        {/* Remove */}
        <div className="flex justify-end">

          {onRemove && (
            <button
              type="button"
              onClick={() =>
                onRemove(item.symbol)
              }
              className="px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap transition-opacity hover:opacity-80"
              style={{
                borderColor:
                  'var(--border-strong)',
                color:
                  'var(--text-tertiary)',
                backgroundColor:
                  'var(--bg-subtle)',
              }}
            >
              Remove
            </button>
          )}

        </div>

      </div>


      {/* Expanded explanation */}
      {showWhy && (
        <div
          className="px-4 pb-4"
        >
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor:
                'var(--bg-subtle)',
              borderColor:
                'var(--border)',
            }}
          >

            {/* Heading */}
            <div className="flex items-center gap-2">

              <span
                className="flex items-center justify-center w-6 h-6 rounded-md text-xs font-semibold"
                style={{
                  backgroundColor:
                    'var(--bg-elevated)',
                  color: accent,
                  border:
                    '1px solid var(--border)',
                }}
              >
                ?
              </span>

              <div
                className="text-xs font-semibold uppercase tracking-wide"
                style={{
                  color:
                    'var(--text-primary)',
                }}
              >
                Why did it change?
              </div>

            </div>


            {/* Reasons */}
            <div className="mt-3">

              <ul className="space-y-2">

                {item.reasons &&
                item.reasons.length > 0 ? (

                  item.reasons.map(
                    (
                      reason,
                      index
                    ) => (
                      <li
                        key={index}
                        className="text-[13px] flex items-start gap-2"
                        style={{
                          color:
                            'var(--text-secondary)',
                        }}
                      >

                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              accent,
                          }}
                        />

                        <span>
                          {reason}
                        </span>

                      </li>
                    )
                  )

                ) : (

                  <li
                    className="text-[13px]"
                    style={{
                      color:
                        'var(--text-secondary)',
                    }}
                  >
                    No unusual activity detected
                    since your last view.
                  </li>

                )}

              </ul>

            </div>


            {/* Combined explanation */}
            {item.explanation && (
              <div
                className="mt-4 pt-3 border-t"
                style={{
                  borderColor:
                    'var(--border)',
                }}
              >

                <div
                  className="text-[11px] font-medium uppercase tracking-wide"
                  style={{
                    color:
                      'var(--text-tertiary)',
                  }}
                >
                  MarketPulse explanation
                </div>

                <p
                  className="mt-1.5 text-[13px] leading-5"
                  style={{
                    color:
                      'var(--text-secondary)',
                  }}
                >
                  {item.explanation}
                </p>

              </div>
            )}


            {/* Disclaimer */}
            {item.explanationDisclaimer && (
              <div
                className="mt-3 text-[11px] leading-4"
                style={{
                  color:
                    'var(--text-tertiary)',
                }}
              >
                ⓘ{' '}
                {
                  item.explanationDisclaimer
                }
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
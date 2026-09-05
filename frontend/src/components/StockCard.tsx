import type { WatchlistItem } from '../types/watchlist';
import { FreshnessBadge } from './FreshnessBadge';

const TIER_ACCENT: Record<string, string> = {
  significant: 'var(--negative)',
  worth_watching: 'var(--attention)',
  normal: 'var(--neutral-tier)',
};

const TIER_LABEL: Record<string, string> = {
  significant: 'SIGNIFICANT',
  worth_watching: 'WORTH WATCHING',
  normal: 'NORMAL',
};

function formatPrice(price?: number) {
  if (price === undefined) return '—';

  return price.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

function formatPercent(value?: number | null) {
  if (value === undefined || value === null) {
    return null;
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function StockCard({
  item,
  size = 'large',
  onRemove,
  onClick,
}: {
  item: WatchlistItem;
  size?: 'large' | 'medium';
  onRemove?: (symbol: string) => void;
  onClick?: (item: WatchlistItem) => void;
}) {
  const isDown = item.direction === 'down';

  const accent =
    TIER_ACCENT[item.tier] || 'var(--neutral-tier)';

  const unavailable =
    item.status !== 'ok';

  const priceSinceLastView =
    formatPercent(item.priceChangeSinceLastView);

  const volumeSinceLastView =
    formatPercent(item.volumeChangeSinceLastView);

  /*
   * Open the stock detail page.
   */
  const openDetails = () => {
    console.log('MarketPulse: clicked', item.symbol);

    if (onClick) {
      onClick(item);
    }
  };

  /*
   * Allow keyboard users to open the stock as well.
   */
  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (!onClick) return;

    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      onClick(item);
    }
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={openDetails}
      onKeyDown={handleCardKeyDown}
      className="rounded-xl border overflow-hidden transition-all duration-150 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-[1px]"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-card)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="flex">

        {/* Tier accent */}
        <div
          className="w-1 shrink-0"
          style={{
            backgroundColor: accent,
          }}
        />

        <div
          className={
            size === 'large'
              ? 'p-5 flex-1'
              : 'p-4 flex-1'
          }
        >

          {/* ================= HEADER ================= */}

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <div
                className="font-semibold"
                style={{
                  color: 'var(--text-primary)',
                  fontSize:
                    size === 'large'
                      ? '17px'
                      : '15px',
                }}
              >
                {item.symbol}
              </div>

              <div
                className="text-xs mt-0.5 truncate"
                style={{
                  color: 'var(--text-tertiary)',
                }}
              >
                {item.name}
              </div>

            </div>

            <div className="flex items-center gap-2 shrink-0">

              <FreshnessBadge
                freshness={item.freshness}
              />

              {onRemove && (
                <button
                  type="button"
                  onClick={(event) => {
                    /*
                     * Prevent Remove from opening
                     * the stock detail page.
                     */
                    event.stopPropagation();

                    onRemove(item.symbol);
                  }}
                  className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-tertiary)',
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                  title={`Remove ${item.symbol} from watchlist`}
                >
                  Remove
                </button>
              )}

            </div>

          </div>

          {/* ================= UNAVAILABLE ================= */}

          {unavailable ? (

            <div
              className="mt-4 text-sm"
              style={{
                color: 'var(--text-secondary)',
              }}
            >
              {item.reasons?.[0] ||
                'Market data is currently unavailable.'}
            </div>

          ) : (

            <>

              {/* ================= PRICE ================= */}

              <div className="mt-3 flex items-baseline gap-2.5">

                <span
                  className="font-semibold tabular-nums"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-data)',
                    fontSize:
                      size === 'large'
                        ? '22px'
                        : '18px',
                  }}
                >
                  {formatPrice(item.price)}
                </span>

              </div>

              {/* ================= LAST VIEW ================= */}

              {size === 'large' && (
                <div className="mt-2">

                  {priceSinceLastView !== null ? (

                    <span
                      className="text-sm font-medium tabular-nums"
                      style={{
                        color: isDown
                          ? 'var(--negative)'
                          : 'var(--positive)',
                        fontFamily: 'var(--font-data)',
                      }}
                    >
                      {priceSinceLastView}{' '}
                      since you last checked
                    </span>

                  ) : (

                    <span
                      className="text-sm"
                      style={{
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      No previous view available
                    </span>

                  )}

                </div>
              )}

              {/* ================= ATTENTION ================= */}

              <div className="mt-4 flex items-center gap-2">

                <span
                  className="text-[11px] font-semibold tracking-wide px-2 py-1 rounded-md"
                  style={{
                    color: accent,
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  {TIER_LABEL[item.tier] || 'NORMAL'}
                </span>

                <span
                  className="text-xs"
                  style={{
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Attention {item.attentionScore}
                </span>

              </div>

              {/* ================= METRICS ================= */}

              {size === 'large' && (
                <div className="mt-4 grid grid-cols-2 gap-3">

                  {/* Price change */}
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                    }}
                  >

                    <div
                      className="text-[11px]"
                      style={{
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      Price change
                    </div>

                    <div
                      className="mt-1 text-sm font-medium tabular-nums"
                      style={{
                        color:
                          priceSinceLastView === null
                            ? 'var(--text-tertiary)'
                            : isDown
                              ? 'var(--negative)'
                              : 'var(--positive)',
                        fontFamily: 'var(--font-data)',
                      }}
                    >
                      {priceSinceLastView || '—'}
                    </div>

                  </div>

                  {/* Volume change */}
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                    }}
                  >

                    <div
                      className="text-[11px]"
                      style={{
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      Volume change
                    </div>

                    <div
                      className="mt-1 text-sm font-medium tabular-nums"
                      style={{
                        color:
                          volumeSinceLastView === null
                            ? 'var(--text-tertiary)'
                            : 'var(--text-primary)',
                        fontFamily: 'var(--font-data)',
                      }}
                    >
                      {volumeSinceLastView || '—'}
                    </div>

                  </div>

                </div>
              )}

              {/* ================= WHY DID IT CHANGE ================= */}

              {size === 'large' && (
                <div
                  className="mt-5 rounded-lg border p-4"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border)',
                  }}
                >

                  <div className="flex items-center gap-2">

                    <span
                      className="flex items-center justify-center w-6 h-6 rounded-md text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: accent,
                        border: '1px solid var(--border)',
                      }}
                    >
                      ?
                    </span>

                    <div
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{
                        color: 'var(--text-primary)',
                      }}
                    >
                      Why did it change?
                    </div>

                  </div>

                  {/* Reasons */}
                  {item.reasons &&
                    item.reasons.length > 0 && (

                    <ul className="mt-3 space-y-2">

                      {item.reasons.map(
                        (reason, index) => (

                          <li
                            key={index}
                            className="text-[13px] flex items-start gap-2"
                            style={{
                              color: 'var(--text-secondary)',
                            }}
                          >

                            <span
                              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: accent,
                              }}
                            />

                            <span>
                              {reason}
                            </span>

                          </li>

                        )
                      )}

                    </ul>

                  )}

                  {/* Explanation */}
                  {item.explanation && (
                    <div
                      className="mt-4 pt-3 border-t"
                      style={{
                        borderColor: 'var(--border)',
                      }}
                    >

                      <div
                        className="text-[11px] font-medium uppercase tracking-wide"
                        style={{
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        MarketPulse explanation
                      </div>

                      <p
                        className="mt-1.5 text-[13px] leading-5"
                        style={{
                          color: 'var(--text-secondary)',
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
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      ⓘ {item.explanationDisclaimer}
                    </div>
                  )}

                </div>
              )}

              {/* ================= ATTENTION BAR ================= */}

              <div className="mt-4 flex items-center justify-between">

                <span
                  className="text-xs"
                  style={{
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Attention score
                </span>

                <div className="flex items-center gap-2">

                  <div
                    className="w-20 h-1.5 rounded-full overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                    }}
                  >

                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            item.attentionScore
                          )
                        )}%`,
                        backgroundColor: accent,
                      }}
                    />

                  </div>

                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-data)',
                    }}
                  >
                    {item.attentionScore}
                  </span>

                </div>

              </div>

              {/* ================= VIEW DETAILS ================= */}

              {onClick && (
                <div
                  className="mt-4 pt-3 border-t flex items-center justify-between"
                  style={{
                    borderColor: 'var(--border)',
                  }}
                >
                  <span
                    className="text-xs"
                    style={{
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    View stock details
                  </span>

                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: accent,
                    }}
                  >
                    Open →
                  </span>
                </div>
              )}

              {/* ================= SOURCE ================= */}

              <div
                className="mt-3 text-[11px]"
                style={{
                  color: 'var(--text-tertiary)',
                }}
              >
                {item.source === 'demo-replay'
                  ? 'DEMO REPLAY · Simulated data'
                  : `Source · ${
                      item.source || 'Unknown'
                    }`}
              </div>

            </>

          )}

        </div>

      </div>

    </div>
  );
}
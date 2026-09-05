import type { WatchlistRecommendation } from '../types/watchlist';

interface RecommendationSectionProps {
  items: WatchlistRecommendation[];
  status: 'loading' | 'ready' | 'error';
  hasWatchlist: boolean;
  addingSymbol: string | null;
  error: string | null;
  onAdd: (item: WatchlistRecommendation) => void;
  onNotInterested: (item: WatchlistRecommendation) => void;
  onAddStock: () => void;
}

export function RecommendationSection({
  items,
  status,
  hasWatchlist,
  addingSymbol,
  error,
  onAdd,
  onNotInterested,
  onAddStock,
}: RecommendationSectionProps) {
  return (
    <section
      className="mt-8 rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Suggested for you
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Based on your watchlist
          </p>
        </div>
      </div>

      {status === 'loading' && (
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Finding suggestions for you...
        </p>
      )}

      {status === 'error' && (
        <p className="mt-5 text-sm" style={{ color: 'var(--attention)' }}>
          Suggestions are temporarily unavailable.
        </p>
      )}

      {status === 'ready' && !hasWatchlist && (
        <div className="mt-5">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Start building your watchlist. Add a few stocks and MarketPulse will personalize suggestions based on what you follow.
          </p>
          <button
            type="button"
            onClick={onAddStock}
            className="mt-4 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-on)' }}
          >
            + Add stock
          </button>
        </div>
      )}

      {status === 'ready' && hasWatchlist && items.length === 0 && (
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          No new suggestions right now.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--negative)' }}>
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.symbol}
              className="rounded-lg border p-4"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
            >
              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.symbol}
              </div>
              <div className="mt-1 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                {item.name}
              </div>
              <p className="mt-4 min-h-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {item.reason}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={addingSymbol !== null}
                  onClick={() => onAdd(item)}
                  className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-on)' }}
                >
                  {addingSymbol === item.symbol ? 'Adding...' : '+ Add'}
                </button>
                <button
                  type="button"
                  disabled={addingSymbol !== null}
                  onClick={() => onNotInterested(item)}
                  className="rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                >
                  Not interested
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

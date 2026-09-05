import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:4000';

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  marketOpen: string;
  marketClose: string;
  timezone: string;
  currency: string;
  matchScore: number;
  exchange?: string;
  instrumentKey?: string;
  isin?: string;
}

interface AddStockModalProps {
  existingSymbols: string[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddStockModal({
  existingSymbols,
  onClose,
  onAdded,
}: AddStockModalProps) {
  const { authFetch } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] =
    useState<SearchResult[]>([]);
  const [searching, setSearching] =
    useState(false);
  const [adding, setAdding] =
    useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const keyword = search.trim();

    if (!keyword) {
      setResults([]);
      setError('');
      setSearching(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');

      try {
        const response = await fetch(
          `${API_BASE}/api/instruments/search?q=${encodeURIComponent(
            keyword
          )}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              'Unable to search stocks'
          );
        }

        const indianResults = (
          data.results || []
        ).filter(
          (stock: SearchResult) =>
            (
              stock.region === 'India/NSE' ||
              stock.region === 'India/Bombay'
            ) &&
            stock.currency === 'INR' &&
            stock.type === 'Equity'
        );

        setResults(indianResults);
        setError('');
      } catch (err) {
        /*
         * AbortError means the user typed something new
         * and the previous request was intentionally cancelled.
         * We should NOT show an error in that case.
         */
        if (
          err instanceof DOMException &&
          err.name === 'AbortError'
        ) {
          return;
        }

        setResults([]);

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to search stocks'
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  async function addStock(
    stock: SearchResult
  ) {
    setAdding(stock.symbol);
    setError('');

    try {
      const response = await authFetch(
        `${API_BASE}/api/watchlist/stocks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: stock.symbol,
            name: stock.name,
            exchange:
              stock.exchange ||
              stock.region,
            currency: stock.currency,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Unable to add stock'
        );
      }

      onAdded();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add stock'
      );
    } finally {
      setAdding(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor:
          'rgba(0, 0, 0, 0.35)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border p-5"
        style={{
          backgroundColor:
            'var(--bg-elevated)',
          borderColor: 'var(--border)',
          boxShadow:
            'var(--shadow-card)',
        }}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{
                color:
                  'var(--text-primary)',
              }}
            >
              Add stock
            </h2>

            <p
              className="text-xs mt-1"
              style={{
                color:
                  'var(--text-tertiary)',
              }}
            >
              Search any Indian company
              or stock.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none"
            style={{
              color:
                'var(--text-tertiary)',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search company or symbol..."
          className="w-full mt-4 px-3 py-2.5 rounded-lg border text-sm outline-none"
          style={{
            backgroundColor:
              'var(--bg-subtle)',
            borderColor: 'var(--border)',
            color:
              'var(--text-primary)',
          }}
          autoFocus
        />

        {error && (
          <div
            className="mt-3 text-xs rounded-lg px-3 py-2"
            style={{
              color:
                'var(--negative)',
              backgroundColor:
                'var(--negative-soft)',
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-3 max-h-72 overflow-y-auto">
          {!search.trim() && (
            <div
              className="py-8 text-center text-sm"
              style={{
                color:
                  'var(--text-tertiary)',
              }}
            >
              Start typing to search
              for a company.
            </div>
          )}

          {search.trim() &&
            searching && (
              <div
                className="py-8 text-center text-sm"
                style={{
                  color:
                    'var(--text-tertiary)',
                }}
              >
                Searching...
              </div>
            )}

          {!searching &&
            search.trim() &&
            results.length === 0 &&
            !error && (
              <div
                className="py-8 text-center text-sm"
                style={{
                  color:
                    'var(--text-tertiary)',
                }}
              >
                No Indian stocks
                found.
              </div>
            )}

          {!searching &&
            results.map((stock) => {
              const alreadyAdded =
                existingSymbols.includes(
                  stock.symbol
                );

              return (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0"
                  style={{
                    borderColor:
                      'var(--border)',
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium"
                      style={{
                        color:
                          'var(--text-primary)',
                      }}
                    >
                      {stock.symbol}
                    </div>

                    <div
                      className="text-xs mt-0.5 truncate"
                      style={{
                        color:
                          'var(--text-tertiary)',
                      }}
                    >
                      {stock.name}
                    </div>

                    <div
                      className="text-[10px] mt-1"
                      style={{
                        color:
                          'var(--text-tertiary)',
                      }}
                    >
                      {stock.exchange ||
                        'NSE/BSE'}{' '}
                      · {stock.currency}
                    </div>
                  </div>

                  {alreadyAdded ? (
                    <span
                      className="text-xs shrink-0"
                      style={{
                        color:
                          'var(--text-tertiary)',
                      }}
                    >
                      Added
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        addStock(stock)
                      }
                      disabled={
                        adding !== null
                      }
                      className="px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-50 shrink-0"
                      style={{
                        borderColor:
                          'var(--border-strong)',
                        color:
                          'var(--text-primary)',
                        backgroundColor:
                          'var(--bg-subtle)',
                      }}
                    >
                      {adding ===
                      stock.symbol
                        ? 'Adding...'
                        : '+ Add'}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
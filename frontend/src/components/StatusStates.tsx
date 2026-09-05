export function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 rounded-xl animate-pulse"
          style={{ backgroundColor: 'var(--bg-subtle)' }}
        />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-xl border p-8 text-center max-w-md mx-auto mt-10"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
    >
      <div
        className="w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ backgroundColor: 'var(--attention-soft)', color: 'var(--attention)' }}
      >
        !
      </div>
      <h3 className="font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
        Market data is unavailable right now
      </h3>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        We couldn't reach the market-data source. Your watchlist and past data are safe — we're
        just not showing anything we can't verify is current.
      </p>
      <button
        onClick={onRetry}
        className="text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-on)' }}
      >
        Try again
      </button>
    </div>
  );
}

export function EmptyWatchlistState({
  onAddStock,
}: {
  onAddStock: () => void;
}) {
  return (
    <div
      className="rounded-xl border p-10 text-center max-w-md mx-auto mt-10"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
    >
      <h3 className="font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
        Your watchlist is empty
      </h3>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Add a few stocks and MarketPulse will start tracking what changes between your visits.
      </p>
      <button
        type="button"
        onClick={onAddStock}
        className="text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-on)' }}
      >
        Add a stock
      </button>
    </div>
  );
}

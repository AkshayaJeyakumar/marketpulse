import { useEffect, useRef } from 'react';

interface ConfirmationModalProps {
  symbol: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationModal({
  symbol,
  busy,
  error,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-dialog-title"
        aria-describedby="remove-dialog-message"
        className="w-full max-w-md rounded-xl border p-5"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h2
          id="remove-dialog-title"
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          Remove {symbol}?
        </h2>

        <p
          id="remove-dialog-message"
          className="mt-2 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          {symbol} will be removed from your watchlist.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg px-3 py-2 text-sm"
            style={{
              color: 'var(--negative)',
              backgroundColor: 'var(--negative-soft)',
            }}
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{
              backgroundColor: 'var(--negative)',
              color: 'var(--brand-on)',
            }}
          >
            {busy ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  watchlistSearch: string;
  onWatchlistSearchChange: (value: string) => void;
}

export function Navbar({
  watchlistSearch,
  onWatchlistSearchChange,
}: NavbarProps) {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    window.history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm"
          style={{
            backgroundColor: 'var(--brand)',
            color: 'var(--brand-on)',
          }}
        >
          M
        </div>

        <div>
          <div
            className="font-semibold text-[15px] leading-tight"
            style={{
              color: 'var(--text-primary)',
            }}
          >
            MarketPulse
          </div>

          <div
            className="text-[11px] leading-tight"
            style={{
              color: 'var(--text-tertiary)',
            }}
          >
            Know what changed. Know what matters.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-xs" style={{ color: 'var(--text-secondary)' }}>
          {user?.displayName}
        </span>

        <button
          type="button"
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-md border"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
        >
          Logout
        </button>

        <input
          type="search"
          value={watchlistSearch}
          onChange={(event) =>
            onWatchlistSearchChange(event.target.value)
          }
          placeholder="Search watchlist..."
          aria-label="Search watchlist by name"
          className="w-40 sm:w-56 rounded-md border px-3 py-1.5 text-xs outline-none"
          style={{
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        />

        <ThemeToggle />
      </div>
    </header>
  );
}
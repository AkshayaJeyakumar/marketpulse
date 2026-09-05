import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="relative w-14 h-8 rounded-full transition-colors duration-200 flex items-center px-1"
      style={{ backgroundColor: isDark ? 'var(--brand)' : 'var(--bg-subtle)', border: '1px solid var(--border-strong)' }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-transform duration-200"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          transform: isDark ? 'translateX(22px)' : 'translateX(0)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}

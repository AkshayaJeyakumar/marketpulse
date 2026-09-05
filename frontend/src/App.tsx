import { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';

function AppContent() {
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const { user, loading } = useAuth();
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleNavigation = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  if (loading) {
    return <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }} />;
  }

  if (!user) {
    if (path !== '/register' && path !== '/login') {
      window.history.replaceState({}, '', '/login');
      return <AuthPage mode="login" />;
    }
    return <AuthPage mode={path === '/register' ? 'register' : 'login'} />;
  }

  if (path === '/login' || path === '/register') {
    window.history.replaceState({}, '', '/dashboard');
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <Navbar
          watchlistSearch={watchlistSearch}
          onWatchlistSearchChange={setWatchlistSearch}
        />
        <Dashboard
          watchlistSearch={watchlistSearch}
          user={user}
        />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:4000';
const TOKEN_KEY = 'marketpulse.auth.token';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readResponse(response: Response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      result.error ||
        (response.status >= 500
          ? 'MarketPulse server error. Check the backend and database.'
          : 'Authentication request failed')
    );
  }
  return result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(readResponse)
      .then((result) => setUser(result.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(async (path: string, body: object) => {
    let response: Response;

    try {
      response = await fetch(`${API_BASE}/api/auth/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
    } catch {
      throw new Error(
        'Unable to connect to MarketPulse server. Make sure the backend is running on port 4000.'
      );
    }

    const result = await readResponse(response);
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser(result.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authenticate('login', { email, password });
  }, [authenticate]);

  const register = useCallback(async (
    displayName: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    await authenticate('register', {
      displayName,
      email,
      password,
      confirmPassword,
    });
  }, [authenticate]);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    if (token) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
    return response;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, authFetch }),
    [user, loading, login, register, logout, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

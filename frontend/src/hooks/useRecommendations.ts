import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { WatchlistRecommendation } from '../types/watchlist';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type RecommendationStatus = 'loading' | 'ready' | 'error';

export function useRecommendations() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<WatchlistRecommendation[]>([]);
  const [status, setStatus] = useState<RecommendationStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');

    try {
      const response = await authFetch(
        `${API_BASE}/api/recommendations/watchlist?_=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`Suggestions request failed: ${response.status}`);
      }

      const result = await response.json();
      setItems(Array.isArray(result.items) ? result.items : []);
      setStatus('ready');
    } catch {
      setItems([]);
      setStatus('error');
    }
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, status, reload };
}

import { useCallback, useEffect, useState } from 'react';
import type { WatchlistView } from '../types/watchlist';
import { useAuth } from '../context/AuthContext';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type Status = 'loading' | 'ready' | 'error';

export function useWatchlist() {
  const { authFetch } = useAuth();
  const [data, setData] =
    useState<WatchlistView | null>(null);

  const [status, setStatus] =
    useState<Status>('loading');


  /*
   * Fetch the current market state.
   *
   * IMPORTANT:
   *
   * This request only READS the current state.
   * It does not acknowledge/save a new user view.
   */
  const load = useCallback(async () => {

    setStatus('loading');

    try {

      const res = await authFetch(
        `${API_BASE}/api/watchlist?_=${Date.now()}`,
        {
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        throw new Error(
          `Request failed: ${res.status}`
        );
      }

      const json: WatchlistView =
        await res.json();

      setData(json);
      setStatus('ready');

    } catch {

      setData(null);
      setStatus('error');

    }

  }, [authFetch]);


  /*
   * Tell the backend that the user has
   * successfully seen the current watchlist.
   *
   * This creates the baseline used by the
   * NEXT visit.
   */
  const acknowledgeView =
    useCallback(async () => {

      try {

        const res = await authFetch(
          `${API_BASE}/api/watchlist/view`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
          }
        );

        if (!res.ok) {
          throw new Error(
            `View acknowledgement failed: ${res.status}`
          );
        }

      } catch (error) {

        /*
         * Acknowledgement failure should not
         * destroy the already-loaded dashboard.
         *
         * The current market data remains visible.
         */
        console.error(
          'Unable to acknowledge watchlist view:',
          error
        );

      }

    }, [authFetch]);


  /*
   * Initial load.
   */
  useEffect(() => {
    load();
  }, [load]);


  /*
   * Return both the data loader and the
   * acknowledgement function.
   */
  return {
    data,
    status,
    reload: load,
    acknowledgeView,
  };
}
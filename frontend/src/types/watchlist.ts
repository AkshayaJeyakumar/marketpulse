export type Tier =
  | 'significant'
  | 'worth_watching'
  | 'normal';

export type Freshness =
  | 'live'
  | 'recent'
  | 'delayed'
  | 'stale'
  | 'unavailable';

export type Direction =
  | 'up'
  | 'down';

export interface WatchlistItem {
  symbol: string;
  name: string;

  price?: number;
  prevClose?: number;

  priceChangeSinceLastView?: number | null;
  volumeChangeSinceLastView?: number | null;

  lastViewedAt?: string | null;

  direction?: Direction;

  volume?: number;

  status:
    | 'ok'
    | 'timeout'
    | 'error'
    | 'market_closed'
    | 'unavailable';

  freshness: Freshness;

  source?: string;
  retrievedAt?: string;
  marketTimestamp?: string | null;

  attentionScore: number;

  tier: Tier;

  signals?: {
    priceSignal: number;
    volumeSignal: number;
    volatilitySignal: number;
  };

  /*
   * Individual reasons behind the
   * attention score.
   */
  reasons: string[];

  /*
   * Combined explanation describing
   * why MarketPulse flagged the stock.
   */
  explanation?: string;

  /*
   * Responsible-use disclaimer.
   */
  explanationDisclaimer?: string;
}

export interface WatchlistView {
  generatedAt: string;

  items: WatchlistItem[];

  summary: {
    significant: number;
    worthWatching: number;
    normal: number;
  };
}

export interface WatchlistRecommendation {
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
  score: number;
  matchType: 'sector';
  reason: string;
}
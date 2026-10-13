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

  // Milestone 3 & 4 Anomaly Engine fields
  anomalyScore?: number;
  anomalyStatus?: string;
  volumeRatio?: number | null;
  returnZScore?: number | null;
  volumeZScore?: number | null;
  volatilityZScore?: number | null;
  isSilentSignal?: boolean;
  summaryText?: string | null;

  // Milestone 6 CAPM Movement Attribution fields
  marketSharePct?: number | null;
  stockSharePct?: number | null;
  attributionStatus?: string;


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

  // NLP & FinBERT Sentiment Analysis
  sentiment?: SentimentData;
}

export interface NewsItem {
  headline: string;
  sentimentLabel: 'positive' | 'negative' | 'neutral' | string;
  signedScore: number;
  sourceUrl?: string | null;
  publishedAt?: string;
  impact_assessment?: string | null;
}

export interface MLForecastMetrics {
  baselineAccuracy: number;
  enhancedAccuracy: number;
  accuracyLift: number;
  f1Baseline: number;
  f1Enhanced: number;
  model: string;
}

export interface SentimentData {
  aggregateScore: number;
  sentimentLabel: 'Positive' | 'Negative' | 'Neutral' | string;
  articleCount: number;
  headlines: NewsItem[];
  mlForecast?: MLForecastMetrics;
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
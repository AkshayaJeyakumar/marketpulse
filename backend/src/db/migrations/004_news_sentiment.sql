-- ============================================================
-- MarketPulse Step 1: news_sentiment Table
-- Stores FinBERT NLP sentiment analysis scores for financial news
-- ============================================================

CREATE TABLE IF NOT EXISTS news_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  headline TEXT NOT NULL,
  sentiment_label VARCHAR(20) NOT NULL CHECK (sentiment_label IN ('positive', 'negative', 'neutral')),
  signed_score NUMERIC(5, 4) NOT NULL CHECK (signed_score >= -1.0000 AND signed_score <= 1.0000),
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_news_ticker_headline UNIQUE (ticker, headline)
);

-- Fast lookup index for ticker news ordered chronologically
CREATE INDEX IF NOT EXISTS idx_news_sentiment_ticker_published 
  ON news_sentiment (ticker, published_at DESC);

-- Index for date-based aggregation and joining with market time series
CREATE INDEX IF NOT EXISTS idx_news_sentiment_published_at 
  ON news_sentiment (published_at DESC);

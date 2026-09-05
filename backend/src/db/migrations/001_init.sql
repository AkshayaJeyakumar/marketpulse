-- MarketPulse Phase 1 schema
-- Core data model: Users, Watchlists, Watchlist Stocks, Market Snapshots,
-- Change Signals, Stock Metadata, Market Data Cache, User Preferences.
--
-- Design notes:
-- - Market data (stock_metadata, market_data_cache) is NOT scoped to a user.
--   Watchlist membership IS scoped to a user. This is what lets us cache
--   market data once and reuse it across every user watching the same stock.
-- - market_snapshots stores "what state the user was shown" without deleting
--   history, so change detection can diff previous-view vs current-market
--   without destructive overwrites.
-- - change_signals is derived/output data: one row per (user, stock, detected
--   change), so the "why was this flagged" explanation has something to point to.

create extension if not exists "uuid-ossp";

-- ============================================================
-- Users
-- ============================================================
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- User preferences (theme, sensitivity, thresholds override)
-- ============================================================
create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  attention_sensitivity numeric not null default 1.0, -- multiplier on scoring, product-level not financial
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Stock metadata (shared across all users — not user-scoped)
-- ============================================================
create table if not exists stock_metadata (
  symbol text primary key,
  name text not null,
  exchange text not null,           -- e.g. NSE, BSE
  sector text,
  isin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Watchlists (user-scoped)
-- ============================================================
create table if not exists watchlists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null default 'My Watchlist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_watchlists_user on watchlists(user_id);

-- ============================================================
-- Watchlist stocks (membership, user-scoped via watchlist)
-- ============================================================
create table if not exists watchlist_stocks (
  id uuid primary key default uuid_generate_v4(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  symbol text not null references stock_metadata(symbol),
  added_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

create index if not exists idx_watchlist_stocks_watchlist on watchlist_stocks(watchlist_id);
create index if not exists idx_watchlist_stocks_symbol on watchlist_stocks(symbol);

-- ============================================================
-- Market data cache (shared across users — provider-facing)
-- One row per symbol holding the latest fetched snapshot from the provider.
-- ============================================================
create table if not exists market_data_cache (
  symbol text primary key references stock_metadata(symbol),
  price numeric,
  volume bigint,
  day_high numeric,
  day_low numeric,
  prev_close numeric,
  source text not null,              -- e.g. 'upstox'
  retrieved_at timestamptz not null, -- when WE fetched it
  market_timestamp timestamptz,      -- when the exchange generated it
  freshness text not null default 'unavailable'
    check (freshness in ('live', 'recent', 'delayed', 'stale', 'unavailable')),
  status text not null default 'unavailable'
    check (status in ('ok', 'timeout', 'error', 'market_closed', 'unavailable')),
  raw_payload jsonb
);

-- ============================================================
-- Market snapshots (per-user "what were they shown" record)
-- Immutable history — new snapshot rows are inserted, never overwritten,
-- so change detection can diff without destroying prior state.
-- ============================================================
create table if not exists market_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  symbol text not null references stock_metadata(symbol),
  price numeric,
  volume bigint,
  freshness text not null,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_snapshots_user_symbol_time
  on market_snapshots(user_id, symbol, viewed_at desc);

-- ============================================================
-- Change signals (derived output — one row per detected change)
-- This is what powers "why was this flagged".
-- ============================================================
create table if not exists change_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  symbol text not null references stock_metadata(symbol),
  price_signal numeric not null default 0,
  volume_signal numeric not null default 0,
  volatility_signal numeric not null default 0,
  attention_score numeric not null default 0,
  tier text not null default 'normal'
    check (tier in ('significant', 'worth_watching', 'normal')),
  reasons jsonb not null default '[]', -- plain-language reason strings, product-level only
  computed_at timestamptz not null default now(),
  previous_snapshot_id uuid references market_snapshots(id),
  current_snapshot_id uuid references market_snapshots(id)
);

create index if not exists idx_change_signals_user_time
  on change_signals(user_id, computed_at desc);

-- ============================================================
-- Attention scoring thresholds (configurable, not hardcoded)
-- ============================================================
create table if not exists attention_thresholds (
  id int primary key default 1,
  significant_min numeric not null default 80,
  worth_watching_min numeric not null default 50,
  price_weight numeric not null default 0.5,
  volume_weight numeric not null default 0.3,
  volatility_weight numeric not null default 0.2,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into attention_thresholds (id) values (1) on conflict (id) do nothing;

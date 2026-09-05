-- User-scoped recommendation dismissals and additional stock metadata.

create table if not exists user_stock_interactions (
  user_id uuid not null references users(id) on delete cascade,
  symbol text not null references stock_metadata(symbol) on delete cascade,
  interaction_type text not null check (interaction_type in ('not_interested', 'added')),
  created_at timestamptz not null default now(),
  primary key (user_id, symbol, interaction_type)
);

create index if not exists idx_user_stock_interactions_user
  on user_stock_interactions(user_id, interaction_type);

insert into stock_metadata (symbol, name, exchange, sector)
values
  ('WIPRO', 'Wipro Limited', 'NSE', 'Information Technology'),
  ('HCLTECH', 'HCL Technologies', 'NSE', 'Information Technology'),
  ('TECHM', 'Tech Mahindra', 'NSE', 'Information Technology'),
  ('LTIM', 'LTIMindtree', 'NSE', 'Information Technology'),
  ('MARUTI', 'Maruti Suzuki India', 'NSE', 'Automobiles'),
  ('M&M', 'Mahindra & Mahindra', 'NSE', 'Automobiles'),
  ('EICHERMOT', 'Eicher Motors', 'NSE', 'Automobiles'),
  ('HEROMOTOCO', 'Hero MotoCorp', 'NSE', 'Automobiles'),
  ('BAJAJ-AUTO', 'Bajaj Auto', 'NSE', 'Automobiles'),
  ('ASHOKLEY', 'Ashok Leyland', 'NSE', 'Automobiles')
on conflict (symbol)
do update set
  name = excluded.name,
  exchange = excluded.exchange,
  sector = excluded.sector,
  updated_at = now();

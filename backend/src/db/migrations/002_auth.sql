-- Password authentication and server-side sessions.

alter table users
  add column if not exists password_hash text;

create table if not exists auth_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_sessions_token
  on auth_sessions(token_hash);

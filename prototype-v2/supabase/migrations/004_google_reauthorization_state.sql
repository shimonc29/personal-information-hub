alter table public.google_connections
  add column if not exists requires_reauthorization boolean not null default false;

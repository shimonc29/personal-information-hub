create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refresh_token_encryption_complete check ((refresh_token_ciphertext is null and refresh_token_iv is null and refresh_token_tag is null) or (refresh_token_ciphertext is not null and refresh_token_iv is not null and refresh_token_tag is not null))
);
alter table public.google_connections enable row level security;
create policy "google_connections_select_own" on public.google_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy "google_connections_insert_own" on public.google_connections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "google_connections_update_own" on public.google_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "google_connections_delete_own" on public.google_connections for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.google_connections from anon;
grant select, insert, update, delete on public.google_connections to authenticated;

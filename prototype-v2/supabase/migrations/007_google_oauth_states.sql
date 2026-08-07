create table if not exists public.google_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique check (char_length(state_hash) = 64),
  session_token_ciphertext text not null,
  session_token_iv text not null,
  session_token_tag text not null,
  code_verifier text not null check (char_length(code_verifier) between 43 and 128),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.google_oauth_states enable row level security;
create policy "google_oauth_states_insert_own" on public.google_oauth_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "google_oauth_states_delete_own" on public.google_oauth_states for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.google_oauth_states from anon;
grant insert, delete on public.google_oauth_states to authenticated;

create or replace function public.consume_google_oauth_state(p_state_hash text)
returns table (
  user_id uuid,
  session_token_ciphertext text,
  session_token_iv text,
  session_token_tag text,
  code_verifier text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  delete from public.google_oauth_states
  where state_hash = p_state_hash and expires_at > now()
  returning user_id, session_token_ciphertext, session_token_iv, session_token_tag, code_verifier, expires_at;
$$;

revoke all on function public.consume_google_oauth_state(text) from public;
grant execute on function public.consume_google_oauth_state(text) to anon, authenticated;
create index if not exists google_oauth_states_expiry_idx on public.google_oauth_states (expires_at);

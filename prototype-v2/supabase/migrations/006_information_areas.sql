create table if not exists public.information_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  tone text not null default 'sage' check (tone in ('sage', 'blue', 'amber', 'violet', 'coral')),
  icon text not null default 'מידע' check (char_length(icon) between 1 and 12),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.information_areas enable row level security;
create policy "information_areas_select_own" on public.information_areas for select to authenticated using ((select auth.uid()) = user_id);
create policy "information_areas_insert_own" on public.information_areas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "information_areas_update_own" on public.information_areas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "information_areas_delete_own" on public.information_areas for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.information_areas from anon;
grant select, insert, update, delete on public.information_areas to authenticated;
create index if not exists information_areas_user_active_idx on public.information_areas (user_id, archived_at, updated_at desc);

alter table public.document_workflows
  add column if not exists information_area_id uuid references public.information_areas(id) on delete set null;

drop policy if exists "document_workflows_insert_own" on public.document_workflows;
drop policy if exists "document_workflows_update_own" on public.document_workflows;
create policy "document_workflows_insert_own" on public.document_workflows for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (project_id is null or exists (select 1 from public.projects where projects.id = project_id and projects.user_id = (select auth.uid())))
  and (information_area_id is null or exists (select 1 from public.information_areas where information_areas.id = information_area_id and information_areas.user_id = (select auth.uid())))
);
create policy "document_workflows_update_own" on public.document_workflows for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and (project_id is null or exists (select 1 from public.projects where projects.id = project_id and projects.user_id = (select auth.uid())))
  and (information_area_id is null or exists (select 1 from public.information_areas where information_areas.id = information_area_id and information_areas.user_id = (select auth.uid())))
);
create index if not exists document_workflows_user_area_idx on public.document_workflows (user_id, information_area_id, updated_at desc);

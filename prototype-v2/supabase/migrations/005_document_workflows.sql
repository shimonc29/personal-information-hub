create table if not exists public.document_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drive_file_id text not null check (char_length(drive_file_id) between 1 and 500),
  project_id uuid references public.projects(id) on delete set null,
  next_action text not null default '',
  handled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, drive_file_id),
  constraint next_action_length check (char_length(next_action) <= 500)
);

alter table public.document_workflows enable row level security;

create policy "document_workflows_select_own" on public.document_workflows
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "document_workflows_insert_own" on public.document_workflows
  for insert to authenticated with check (
    (select auth.uid()) = user_id and
    (project_id is null or exists (
      select 1 from public.projects
      where projects.id = project_id and projects.user_id = (select auth.uid())
    ))
  );
create policy "document_workflows_update_own" on public.document_workflows
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id and
    (project_id is null or exists (
      select 1 from public.projects
      where projects.id = project_id and projects.user_id = (select auth.uid())
    ))
  );
create policy "document_workflows_delete_own" on public.document_workflows
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.document_workflows from anon;
grant select, insert, update, delete on public.document_workflows to authenticated;

create index if not exists document_workflows_user_handled_idx
  on public.document_workflows (user_id, handled, updated_at desc);

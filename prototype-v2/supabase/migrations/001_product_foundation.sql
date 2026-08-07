-- Ownership model follows Supabase RLS guidance:
-- https://supabase.com/docs/guides/database/postgres/row-level-security
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  slug text not null,
  client text not null default '',
  description text not null default '',
  status text not null default 'active' check (status in ('planning', 'active', 'waiting', 'completed', 'archived')),
  status_label text not null default '',
  documents_count integer not null default 0,
  people_count integer not null default 0,
  tasks_count integer not null default 0,
  next_action text not null default '',
  updated_label text not null default '',
  tone text not null default 'gray',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index projects_user_slug_unique on public.projects(user_id, slug);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_label text not null default '',
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects(user_id);
create index tasks_user_id_idx on public.tasks(user_id);
create index tasks_project_id_idx on public.tasks(project_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "projects_select_own" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects_insert_own" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects_update_own" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects_delete_own" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_select_own" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check (
  (select auth.uid()) = user_id and
  (project_id is null or exists (select 1 from public.projects where projects.id = project_id and projects.user_id = (select auth.uid())))
);
create policy "tasks_update_own" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id and
  (project_id is null or exists (select 1 from public.projects where projects.id = project_id and projects.user_id = (select auth.uid())))
);
create policy "tasks_delete_own" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

-- The browser never supplies ownership. PostgreSQL derives it from the authenticated JWT.
alter table public.profiles alter column user_id set default auth.uid();
alter table public.projects alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set default auth.uid();

create or replace function public.seed_my_sample_projects()
returns void language sql security invoker set search_path = '' as $$
  insert into public.projects (user_id, slug, name, client, status, status_label, documents_count, people_count, tasks_count, next_action, updated_label, tone)
  values
    (auth.uid(), 'akim', 'סדנת AI לאקים', 'אקים ישראל', 'waiting', 'ממתין לאישור', 8, 3, 2, 'לחזור ללקוח בנוגע להצעה', 'לפני 4 ימים', 'violet'),
    (auth.uid(), 'heritage-184', 'מערכת מורשת גדוד 184', 'עמותת מורשת 184', 'planning', 'בתכנון', 17, 4, 6, 'עדכון מסמך האפיון', 'היום', 'blue'),
    (auth.uid(), 'ariel', 'אריאל גינון', 'אריאל גינון ופיתוח', 'active', 'מתקדם', 11, 2, 3, 'שליחת דף ההדגמה', 'לפני שעה', 'green'),
    (auth.uid(), 'family-center', 'מרכז משפחתי', 'יוזמה קהילתית', 'planning', 'בתכנון', 5, 6, 4, 'לקבוע פגישת התנעה', 'אתמול', 'amber'),
    (auth.uid(), 'garinim', 'גרעינים תורניים', 'עמותת גרעינים', 'waiting', 'ממתין למשוב', 13, 5, 1, 'לקבל אישור למסמך', 'לפני 3 ימים', 'coral'),
    (auth.uid(), 'melodies', 'אתר מנגינות', 'מנגינות ישראל', 'completed', 'הושלם', 22, 3, 0, 'אין משימות פתוחות', 'לפני שבוע', 'gray')
  on conflict (user_id, slug) do nothing;
$$;
revoke execute on function public.seed_my_sample_projects() from public, anon;
grant execute on function public.seed_my_sample_projects() to authenticated;

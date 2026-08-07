-- Replace the deployed seed routine without changing existing user projects.
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

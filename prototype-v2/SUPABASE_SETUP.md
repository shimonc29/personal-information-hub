# חיבור Supabase

האפליקציה משתמשת ב־`@supabase/supabase-js` הרשמי, ב־PKCE וב־Magic Link. ה־session וה־PKCE verifier נשמרים ב־`localStorage` כדי שקישור שנפתח בלשונית חדשה יעבוד. מדיניות CSP מצמצמת את סיכון ה־XSS; אין בקוד קריאה או פענוח ידני של tokens.

1. מריצים ב־SQL Editor את `supabase/migrations/001_product_foundation.sql` בפרויקט חדש.
2. בפרויקט שכבר קיבל את 001, מריצים גם את `supabase/migrations/002_non_destructive_seed.sql`. השינוי אינו דורס עריכות בפרויקטים קיימים.
3. ב־Authentication → URL Configuration מוסיפים `http://127.0.0.1:4173/login.html` כ־Redirect URL.
4. אין להעביר לדפדפן secret או `service_role`; משתמשים רק ב־Publishable Key.

הרצה מקומית מול Supabase:

```powershell
node --env-file=prototype-v2/.env.local prototype-v2/server.mjs 4173
```

אימות קובץ ה־SDK המקומי לאחר התקנת התלויות:

```powershell
npm --prefix prototype-v2 run vendor:check
```

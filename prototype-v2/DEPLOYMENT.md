# הרצה ופריסה

סודות השרת נשמרים רק ב־`.env.product.local` בשורש סביבת העבודה, מחוץ ל־`prototype-v2`. להפעלה מקומית במצב מוצר:

```powershell
node --env-file=.env.product.local prototype-v2/server.mjs 4173
```

אין לפרוס או להעתיק את הקובץ הזה לתיקייה הסטטית. בפריסה אמיתית מגדירים את אותם ערכים במנהל הסודות של ספק האחסון.

## פיתוח מקומי

```powershell
$env:PRODUCT_MODE='development'
node prototype-v2/server.mjs 4173
```

## ייצור

שירות האחסון חייב לתמוך ב־Node וב־HTTPS. מגדירים:

```text
PRODUCT_MODE=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_TOKEN_ENCRYPTION_KEY=YOUR_32_BYTE_BASE64_KEY
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/connections/google/callback
```

לפני פריסה מריצים:

```powershell
npm --prefix prototype-v2 ci
npm --prefix prototype-v2 run vendor:check
npm --prefix prototype-v2 test
```

ב־Supabase מגדירים את `https://YOUR_DOMAIN/login.html` כ־Redirect URL ואת כתובת האתר כ־Site URL. אין להגדיר בדפדפן Secret Key או `service_role`.

## GitHub ו־Vercel

1. יוצרים מאגר GitHub פרטי ומעלים אליו את הפרויקט בלי `.env.product.local`.
2. מייבאים את המאגר ל־Vercel. הקובץ `vercel.json` מפעיל את אותו שרת Node שמריץ את המוצר המקומי.
3. מוסיפים ב־Vercel את כל משתני הסביבה שלמעלה עבור Production ו־Preview.
4. ב־Supabase מוסיפים `https://YOUR_DOMAIN/login.html` לרשימת Redirect URLs ומעדכנים את Site URL.
5. ב־Google Cloud מוסיפים את הערך של `GOOGLE_REDIRECT_URI` לרשימת Authorized redirect URIs.
6. לאחר הפריסה בודקים התחברות, יצירת אזור מידע, טעינת Drive ושיוך מסמך בטוח.

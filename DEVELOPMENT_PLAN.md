# תוכנית עבודה מלאה — מרכז מידע אישי חכם

## 1. מטרת התוכנית

להפוך את `personal_information_hub_prototype.html` מאבטיפוס HTML חד־קובצי לממשק מוצר מודולרי, נגיש, רספונסיבי ומוכן לחיבור לנתונים אמיתיים.

התוצר הראשון יהיה MVP המדגים מקצה לקצה את המסלול המרכזי:

1. כניסה למערכת.
2. חיבור Google Drive ובחירת תיקיות.
3. הצגת סריקה וזיהוי פרויקטים.
4. כניסה לדשבורד.
5. טיפול בהתראה על הצעת מחיר ללא מענה.
6. פתיחת פרויקט אקים.
7. יצירת משימת מעקב.
8. אימות שהמשימה מופיעה במרכז המשימות.

משפט הערך המנחה: **המערכת לא רק מוצאת מידע — היא מבינה מה קורה ומציעה מה לעשות.**

## 2. מקורות אמת

### אפיון מוצר

- השיחה המשותפת, הכותרת `מפת מסכים וחוויית משתמש — מרכז מידע אישי חכם`, סעיפים 1–22.
- הסעיפים המרכזיים לביצוע: `21. המסכים הנדרשים לאבטיפוס הראשון` ו־`22. המסלול המרכזי באבטיפוס`.
- דרישות האמון ל־AI מתוך `10. שאל את המידע שלי`: מקור המידע, קישורים למקורות, רמת ביטחון והבחנה בין עובדה להערכת מערכת.
- דרישות פרטיות מתוך `13. מסך החיבורים` ו־`14. מסך ההגדרות והפרטיות`.

### אבטיפוס קיים

- `personal_information_hub_prototype.html`, מוצג ומצורף בשיחה.
- מסמך יחיד של כ־31KB, `lang="he"`, `dir="rtl"`, עם CSS ו־JavaScript פנימיים.
- מסכים קיימים בקוד: `dashboard`, `projects`, `projectDetail`, `documents`, `tasks`, `people`, `timeline`, `alerts`, `searchPage`, `ask`, `connections`, `settings`.
- עיצוב קיים: משתני צבע CSS, תפריט צד, topbar, cards, grids, tabs, toast ו־drawer.
- breakpoints קיימים: `1000px` ו־`600px`.
- האינטראקציה מבוססת החלפת `section.page`, מאזיני DOM ונתוני דמה מקומיים.

## 3. גבולות גרסה

### MVP ממשק — חובה

- עברית ו־RTL מלאים, דסקטופ ומובייל.
- 12 המסכים שכבר קיימים באבטיפוס.
- מסכי כניסה, חיבור Drive, בחירת תיקיות וסריקה.
- עמוד מסמך מלא.
- מסלול אקים עובד עם state משותף בין דשבורד, פרויקט ומשימות.
- loading, empty, error, offline/retry, success ו־permission-denied למסכים המרכזיים.
- נגישות WCAG 2.2 AA ברכיבים ובמסלול המרכזי.
- שכבת API מדומה עם חוזים יציבים, כך שניתן להחליפה בשרת אמיתי.
- בדיקות יחידה, רכיבים ו־E2E למסלול המרכזי.

### גרסת מוצר מחוברת — לאחר MVP

- אימות משתמשים אמיתי.
- OAuth והרשאות Google Drive.
- סנכרון, webhook או polling, חילוץ טקסט ו־OCR.
- בסיס נתונים, חיפוש סמנטי ושירותי AI.
- Gmail ו־Calendar.
- אבטחה, ניטור, מחיקת מידע ועמידה במדיניות פרטיות.

### מחוץ ל־MVP הראשון

- שיתוף צוותי והרשאות מרובות תפקידים.
- אפליקציות native.
- עריכת קבצי המקור בתוך המערכת.
- אוטומציות שפועלות ללא אישור המשתמש.

## 4. ארכיטקטורה מומלצת

המלצה להתחלה: React + TypeScript + Vite, React Router, TanStack Query, React Hook Form + Zod, Storybook, Vitest/Testing Library ו־Playwright. יש לאמת גרסאות וחתימות מול התיעוד הרשמי בזמן ההקמה; אין לקבע בתוכנית מספרי גרסאות שטרם נבדקו.

מבנה יעד:

```text
src/
  app/              # bootstrap, routing, providers, layout
  routes/           # רכיבי מסך לפי נתיב
  features/         # onboarding, projects, documents, tasks, ask, connections
  entities/         # project, document, task, person, notification, source
  components/       # רכיבי UI משותפים
  services/         # API clients וחוזים
  mocks/            # handlers ונתוני אקים
  styles/           # tokens, globals, RTL, responsive
  test/             # fixtures ו־helpers
```

נתיבים ראשיים:

```text
/login
/onboarding/goal
/onboarding/drive
/onboarding/folders
/onboarding/privacy
/onboarding/scan
/dashboard
/projects
/projects/:projectId
/documents
/documents/:documentId
/tasks
/people
/people/:personId
/timeline
/notifications
/search
/ask
/connections
/settings/:section?
```

עקרונות:

- ה־URL הוא מקור האמת לניווט; לא להסתמך על `display:none` והחלפת class.
- נתוני שרת נשמרים בשכבת query/cache; state מקומי נשמר ברכיב או feature store קטן בלבד.
- כל ישות מקבלת ID יציב וחוזה TypeScript.
- רכיבי UI אינם יודעים אם המידע מגיע מ־mock או משרת אמיתי.
- פעולות AI מוצגות כהצעות עד שהמשתמש מאשר אותן.
- כל טקסט, מספר, תאריך וסטטוס מגיעים מהנתונים ולא מקודדים בתוך הרכיב.

## 5. מודל נתונים ראשוני

ישויות חובה:

- `User`, `LifeArea`, `Project`, `Document`, `Task`, `Person`, `Organization`.
- `Event`, `Meeting`, `Expense`, `Note`, `Notification`, `Activity`.
- `InformationSource`, `DriveConnection`, `FolderPermission`, `SyncRun`.
- `AiSuggestion`, `AiAnswer`, `Evidence`, `ExtractedField`, `Classification`.

שדות קריטיים:

- `Project`: id, name, status, client, importance, updatedAt, nextTaskId, related entity IDs.
- `Document`: source, sourceUrl, mimeType, projectId, classification, sensitivity, summary, extractedFields, flags.
- `Task`: status, priority, dueAt, projectId, personId, documentId, suggestionId.
- `Evidence`: sourceId, sourceTitle, sourceUrl, excerpt/field reference, confidence, assertionType (`fact`/`estimate`).
- `AiSuggestion`: reason, evidenceIds, proposedAction, state (`proposed`/`approved`/`dismissed`/`snoozed`).

## 6. תוכנית ביצוע מדורגת

### שלב 0 — גילוי מסמכים, החלטות וחוזי API

**מה לבצע**

- לשמור עותק מקומי של קובץ ההדגמה ולתעד את התנהגות כל הכפתורים.
- ליצור מטריצת התאמה: סעיפי האפיון מול מסכי/רכיבי האבטיפוס ומול סטטוס הביצוע.
- לבחור stack ולנעול ADR קצר לארכיטקטורה, routing, data fetching, forms ו־testing.
- לקרוא את התיעוד הרשמי של הכלים שנבחרו וליצור `docs/allowed-apis.md` עם imports, APIs וחתימות מותרות.
- להגדיר חוזי API ונתוני mock לפני חיבור לשירותים אמיתיים.

**מקורות**

- האבטיפוס: מבנה `.app`, `.nav`, `.page`, `.card`, `.drawer`, משתני `:root` ו־event handlers.
- האפיון: סעיפים 1–22, בעיקר 17–22.

**אימות**

- לכל מסך באפיון יש route, owner, data contract וקריטריון קבלה.
- לכל ספרייה יש קישור לתיעוד רשמי ודוגמת שימוש מאושרת.
- אין החלטות טכניות פתוחות שחוסמות את שלב 1.

**מניעת אנטי־דפוסים**

- לא להמציא APIs או props שאינם בתיעוד.
- לא להתחיל חיבור Google לפני אישור scopes, מדיניות פרטיות וחוזה שרת.
- לא להעתיק את קובץ ה־HTML כולו לרכיב React יחיד.

**הערכה**: 2–3 ימי עבודה.

### שלב 1 — תשתית פרויקט ומערכת עיצוב

**מה לבצע**

- להקים פרויקט TypeScript, lint, format, test, build ו־CI.
- להעתיק את שפת העיצוב מהאבטיפוס ל־tokens: צבעים, spacing, radius, shadow, typography ו־status colors.
- לבנות primitives: Button, IconButton, Input, Select, Tabs, Card, Badge, Toast, Drawer, Modal, Skeleton, EmptyState ו־ErrorState.
- להגדיר RTL גלובלי, logical CSS properties ותמיכה ב־keyboard/focus.
- להקים Storybook לכל primitive ולכל state.

**מקורות**

- קוד האבטיפוס: `:root`, `.topbar`, `.card`, `.status`, `.tabs`, `.toast`, `.drawer` ו־media queries.
- האפיון: סעיפים 1, 3, 12, 15 ו־16.

**אימות**

- build, lint, typecheck ו־unit tests עוברים.
- כל primitive מוצג ב־RTL, מובייל ודסקטופ.
- בדיקת contrast ו־focus גלוי עוברת.

**מניעת אנטי־דפוסים**

- לא להשתמש ב־inline styles לתבניות שחוזרות.
- לא להשתמש בצבע לבדו להעברת סטטוס.
- לא להשאיר emoji כאייקונים סופיים ללא accessible name מתאים.

**הערכה**: 4–6 ימים.

### שלב 2 — מעטפת, routing וניווט רספונסיבי

**מה לבצע**

- לבנות AppShell עם sidebar ימני בדסקטופ, topbar ו־bottom navigation במובייל.
- לחבר routes, breadcrumbs, כותרת מסך, global search, Add menu, notifications ו־profile.
- לשמר deep links, refresh, back/forward ו־404.
- להגדיר responsive behavior ולא רק להסתיר sidebar.

**מקורות**

- האבטיפוס: `aside`, `.topbar`, `.mobile-menu`, `.drawer`.
- האפיון: `1. מבנה הניווט הראשי`, `15. כפתור ההוספה`, `16. מבנה המערכת בנייד`.

**אימות**

- ניווט עכבר ומקלדת עובד בכל route.
- refresh בנתיב פנימי אינו מחזיר 404.
- sidebar, drawer ו־bottom nav אינם מוצגים יחד בטעות.

**מניעת אנטי־דפוסים**

- לא לנהל ניווט באמצעות classes בלבד.
- לא לשכפל הגדרות ניווט בשלושה רכיבים; להשתמש במודל navigation יחיד.

**הערכה**: 3–4 ימים.

### שלב 3 — שכבת נתונים מדומה וחוזים

**מה לבצע**

- להגדיר schemas/types לכל הישויות.
- ליצור repository/client interface ו־mock handlers ל־list/detail/mutations.
- לבנות fixture עקבי לתרחיש אקים, כולל quote, person, alert ו־follow-up task.
- להוסיף latency, error ו־empty variants מבוקרים.
- להגדיר optimistic update או invalidate/refetch ליצירת משימה וסימון התראה.

**מקורות**

- האפיון: סעיפים 2–12 ו־20.
- נתוני הדמה באבטיפוס: אקים, מורשת 184 ואריאל גינון.

**אימות**

- אותו task ID מוצג בפרויקט ובמרכז המשימות.
- יצירת משימת מעקב משנה את ההתראה ואת מונה המשימות.
- runtime validation דוחה payload לא תקין.

**מניעת אנטי־דפוסים**

- לא להחזיק עותקים בלתי תלויים של אותם נתונים במסכים שונים.
- לא לקודד מערכי דמה בתוך רכיבי המסך.

**הערכה**: 3–5 ימים.

### שלב 4 — onboarding והמסלול הראשוני

**מה לבצע**

- Login, בחירת מטרת שימוש, Drive connect, folder selection, privacy ו־scan progress.
- מסך סריקה עם שלבי progress, פריטים שזוהו, אישור/סידור ראשוני, retry ו־permission errors.
- wizard state מתמשך המאפשר חזרה לשלב קודם ללא אובדן בחירות.
- ב־MVP להשתמש ב־OAuth מדומה; חיבור אמיתי יבוצע רק בגרסת integration.

**מקורות**

- `17. זרימת משתמש ראשונה`, `13. מסך החיבורים`, `14. מסך ההגדרות והפרטיות`, `21. המסכים הנדרשים לאבטיפוס הראשון`.

**אימות**

- E2E: login → folders → privacy → scan → dashboard.
- אין אפשרות לסרוק תיקייה שלא אושרה.
- ביטול/כשל/refresh משחזרים מצב צפוי.

**מניעת אנטי־דפוסים**

- לא להציג OAuth אמיתי כאילו הוא עובד כאשר הוא mock.
- לא לבחור כברירת מחדל תיקיות רגישות.

**הערכה**: 5–7 ימים.

### שלב 5 — דשבורד, פרויקטים ועמוד פרויקט

**מה לבצע**

- דשבורד: greeting, AI quick ask, attention metrics, active projects, upcoming week ו־recent activity.
- Projects: tabs, search, filters, cards, board view ויצירה.
- Project detail: header/actions, AI summary/evidence, tabs, key metrics, recent docs ו־timeline.
- להשלים empty/loading/error ו־mobile layouts.

**מקורות**

- `2. דף הבית`, `3. מסך הפרויקטים`, `4. עמוד פרויקט`.
- רכיבי האבטיפוס: `.ai-box`, `.attention-card`, `.project-card`, `.summary-ai`, `.metrics`.

**אימות**

- פתיחת alert בדשבורד מגיעה לפרויקט אקים.
- filters משתקפים ב־URL ומחזיקים refresh.
- סטטוס מוצג בטקסט ובצבע בהתאם למפה שהוגדרה.

**מניעת אנטי־דפוסים**

- לא להציג המלצת AI ללא evidence/confidence.
- לא לבצע שינוי destructive דרך כרטיס ללא confirmation.

**הערכה**: 7–10 ימים.

### שלב 6 — מסמכים ועמוד מסמך

**מה לבצע**

- מרכז מסמכים עם semantic-query UI, filters, tabs, flags ו־result cards.
- עמוד מסמך עם preview, metadata, extracted fields, AI summary, missing fields ו־related docs.
- actions: open original, download, create task, edit classification.
- תצוגות unsupported preview, sensitive document, processing ו־failed extraction.

**מקורות**

- `5. מרכז המסמכים`, `6. עמוד מסמך`, `18. זרימת מסמך חדש`.

**אימות**

- deep link למסמך עובד.
- כל extracted field מציג מקור ורמת ביטחון כאשר זמינים.
- מסמך רגיש אינו נשלח ל־AI כשההרשאה כבויה.

**מניעת אנטי־דפוסים**

- לא להציג טקסט שחולץ כעובדה ללא provenance.
- לא לטעון קובץ מלא לרכיב list.

**הערכה**: 6–8 ימים.

### שלב 7 — משימות, אנשים, ציר זמן והתראות

**מה לבצע**

- Tasks views, completion, postpone, create form ו־suggested-task decisions.
- People list/detail והיסטוריית קשר.
- Timeline filters וקיבוץ כרונולוגי.
- Notifications tabs/actions והשתקפות הפעולות בשאר המערכת.

**מקורות**

- סעיפים 7, 8, 11, 12 ו־19.

**אימות**

- תרחיש quote בן 7 ימים מייצר suggestion, לא task אוטומטי.
- approve יוצר task פעם אחת בלבד; dismiss/snooze נשמרים.
- פעולה בהתראה מעדכנת מונים ו־timeline.

**מניעת אנטי־דפוסים**

- לא ליצור משימה אוטומטית ללא אישור.
- לא לאפשר duplicate mutation בלחיצה כפולה.

**הערכה**: 6–8 ימים.

### שלב 8 — חיפוש חכם ו־Ask My Information

**מה לבצע**

- Search עם query, recent searches, categories, ranking explanation ו־highlighted evidence.
- Ask עם מצב שיחה, answer sections, sources, confidence, fact/estimate labels ו־bulk actions.
- states: no results, partial answer, low confidence, stale source, unavailable source ו־AI failure.
- streaming UI רק אם חוזה השרת תומך בו במפורש.

**מקורות**

- `9. החיפוש החכם`, `10. שאל את המידע שלי`.

**אימות**

- כל טענה בתשובה מקושרת ל־Evidence.
- source links נפתחים ליעד הנכון.
- screen reader מקריא confidence ו־fact/estimate באופן ברור.

**מניעת אנטי־דפוסים**

- לא להציג תשובת AI ללא מקורות.
- לא להמציא streaming API או citation shape.

**הערכה**: 5–7 ימים לממשק עם mock; שירות AI אמיתי מתומחר בנפרד.

### שלב 9 — Connections, Settings, Privacy ו־Security UX

**מה לבצע**

- connected/unconnected/syncing/error states ל־Drive, Gmail ו־Calendar.
- folder permissions, sync now, disconnect ו־re-auth.
- storage mode, AI permissions, notifications, security ו־data deletion screens.
- confirmations לפעולות ניתוק ומחיקה ותצוגת audit-friendly status.

**מקורות**

- סעיפים 13 ו־14.

**אימות**

- כיבוי AI למסמכים רגישים משנה את התנהגות המסמך וה־Ask.
- disconnect/delete דורשים confirmation ומציגים scope מדויק.
- המקור נשאר ב־Drive בהתאם לאפיון.

**מניעת אנטי־דפוסים**

- לא להשתמש ב־dark patterns בהרשאות.
- לא לטעון שהמידע נמחק לפני אישור מהשרת.

**הערכה**: 4–6 ימים.

### שלב 10 — חיבור לשירותים אמיתיים

**מה לבצע**

- להחליף mock client במימוש API בלי לשנות רכיבי UI.
- auth/session, Drive OAuth, folder picker, sync status ו־document processing jobs.
- להוסיף idempotency, pagination, cancellation, retry policy ו־permission recovery.
- לתעד חוזי API ב־OpenAPI או schema מוסכם ולהפיק types רק בדרך הנתמכת בתיעוד.

**מקורות**

- חוזי שלב 0 וה־backend docs שיאושרו.
- Google APIs official documentation בלבד בזמן הביצוע.

**אימות**

- contract tests בין frontend לשרת.
- OAuth scopes מינימליים ומוצגים למשתמש.
- mock ו־real client עוברים אותה conformance suite.

**מניעת אנטי־דפוסים**

- לא לקרוא ישירות ל־Google APIs מתוך רכיבי UI.
- לא לשמור tokens ב־localStorage.
- לא לבצע retry עיוור על mutations.

**הערכה**: 2–4 שבועות לממשק והאינטגרציה; לא כולל בניית pipeline מלא ל־AI/OCR.

### שלב 11 — נגישות, ביצועים ואבטחת ממשק

**מה לבצע**

- audit WCAG 2.2 AA: landmarks, headings, labels, focus order, dialogs, live regions, contrast ו־reduced motion.
- lazy loading לפי route, virtualization לרשימות גדולות, image/file preview limits ו־bundle budgets.
- XSS/content sanitization, CSP plan, safe external links ו־PII redaction בלוגים.
- בדיקת RTL בכל breakpoints ובטקסטים ארוכים.

**מקורות**

- התיעוד הרשמי של הדפדפן, framework ו־WCAG; לתעד ב־`allowed-apis.md`.

**אימות**

- keyboard-only golden path.
- axe ללא הפרות critical/serious.
- יעדי Lighthouse מוסכמים: Accessibility ≥95, Performance ≥85 במסכי MVP בסביבת בדיקה.
- אין overflow אופקי ב־320px, 768px, 1024px ו־1440px.

**מניעת אנטי־דפוסים**

- לא להסתמך על Lighthouse בלבד כבדיקת נגישות.
- לא להכניס HTML ממסמך או AI ישירות ל־DOM.

**הערכה**: 4–6 ימים ועוד תיקונים שמתגלים.

### שלב 12 — Verification, UAT והשקה

**מה לבצע**

- לבדוק מחדש שכל implementation תואם לתיעוד ולחוזים שאושרו.
- unit/component/integration/E2E, visual regression, responsive, RTL ו־cross-browser.
- להריץ grep/checks לאנטי־דפוסים ידועים: hard-coded mock data ברכיבים, direct API calls, missing labels, unsafe HTML ו־console PII.
- UAT על המסלול המרכזי עם המשתמש ולקבע backlog לגרסה הבאה.
- deployment preview, error monitoring, analytics events ו־rollback procedure.

**אימות שחרור**

- כל בדיקות ה־CI עוברות.
- אין פגמי P0/P1 פתוחים.
- golden path עובר בדסקטופ ובמובייל.
- privacy/permission copy אושר.
- monitoring ו־rollback נבדקו.

**מניעת אנטי־דפוסים**

- לא לשחרר על בסיס demo ידני בלבד.
- לא להתעלם מ־loading/error/empty states.
- לא לסמן telemetry כהצלחה לפני אימות קליטה בפועל.

**הערכה**: 4–6 ימים.

## 7. תוכנית בדיקות

### Unit

- status/priority/date formatting.
- reducers/state transitions להצעות AI ולמשימות.
- schema validation והרשאות מסמך רגיש.

### Component

- כל primitive בכל state.
- filters/tabs/forms/modals/toasts.
- AI answer עם evidence, confidence ו־fact/estimate.

### Integration

- dashboard counters מול repositories.
- create task מעדכן project, tasks, notifications ו־timeline.
- privacy setting חוסם processing מתאים.

### E2E חובה

- onboarding מלא.
- golden path של אקים.
- חיפוש ופתיחת מקור.
- Ask עם מקורות ויצירת משימות.
- Drive permission denied/re-auth.
- מסמך רגיש כשה־AI כבוי.
- mobile navigation ו־keyboard-only.

## 8. Definition of Done לכל מסך

- route ו־deep link עובדים.
- desktop/mobile/RTL מאושרים.
- loading/empty/error/success/permission states קיימים.
- keyboard, focus ו־screen-reader semantics נבדקו.
- אין נתוני דמה מקודדים ברכיב.
- events אנליטיים מוגדרים ללא PII.
- unit/component/E2E הרלוונטיים עוברים.
- copy, מקור, confidence ו־fact/estimate קיימים בכל תוצר AI.

## 9. סדר עדיפויות ולוח זמנים

בהנחה של מפתח frontend אחד במשרה מלאה, design review חלקי ו־API מדומה:

- שבוע 1: שלבים 0–2.
- שבוע 2: שלבים 3–4.
- שבועות 3–4: שלבים 5–7.
- שבוע 5: שלבים 8–9.
- שבוע 6: שלבים 11–12 ו־UAT.

כלומר: **כ־6–8 שבועות ל־MVP ממשק איכותי עם נתונים מדומים**. חיבור backend, Google Drive ו־AI אמיתי מוסיף בדרך כלל **3–6 שבועות לפחות**, בהתאם למוכנות השירותים, OAuth, OCR, מודל ההרשאות והיקף סוגי הקבצים.

עם צוות של frontend + backend + designer/QA ניתן לעבוד במקביל ולקצר זמן קלנדרי, אך לא לדלג על חוזים, נגישות, פרטיות ו־verification.

## 10. החלטות שנדרשות לפני תחילת הפיתוח

1. האם היעד הבא הוא demo משופר או מוצר שמתחבר מיד ל־Drive אמיתי?
2. מי המשתמש היחיד ב־MVP, והאם נדרשים ארגונים/צוותים?
3. מהו מנגנון ההתחברות והיכן ירוץ השרת?
4. אילו סוגי קבצים נתמכים, והאם נדרש OCR בעברית?
5. מה נשמר: metadata, תקציר, טקסט מלא, embeddings — ולכמה זמן?
6. אילו Drive scopes מאושרים, והאם הגישה read-only?
7. מהו מקור האמת לזיהוי “לא התקבלה תשובה” — Drive, Gmail או אישור משתמש?
8. איזה ספק AI/embedding/search ישמש ומה מדיניות שליחת מידע רגיש?
9. האם Gmail ו־Calendar נכנסים לגרסה הראשונה או נשארים placeholders?
10. היכן תתארח המערכת ומהן דרישות אבטחה, גיבוי, מחיקה וניטור?

## 11. צעד הביצוע הבא

1. להוריד את `personal_information_hub_prototype.html` מהשיחה ולשמור אותו בתיקיית הפרויקט.
2. לפתוח Phase 0 וליצור מטריצת spec-to-screen מלאה.
3. לענות על עשר ההחלטות הפתוחות לעיל.
4. לאחר מכן להקים את התשתית ולבצע את השלבים ברצף, כאשר כל שלב מסתיים בבדיקות וב־demo מאושר.

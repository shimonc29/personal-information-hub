"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { fetchAllDriveFiles, toDocument } from "@/lib/drive-client.mjs";

export default function Home() {
  const [active, setActive] = useState("בית");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [email, setEmail] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [driveDocuments, setDriveDocuments] = useState<ReturnType<typeof toDocument>[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);

  const visibleDocuments = driveConnected ? driveDocuments : [];
  const filteredDocs = useMemo(() => visibleDocuments.filter((d) =>
    `${d.title} ${d.type} ${d.project} ${d.person}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [query, visibleDocuments]);
  const today = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    let cancelled = false;
    async function loadDrive() {
      try {
        const configResponse = await fetch("/api/config");
        if (!configResponse.ok) return;
        const config = await configResponse.json();
        const client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } });
        const { data } = await client.auth.getSession();
        if (!data.session || cancelled) return;
        const statusResponse = await fetch("/api/connections/google/status", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
        const status = statusResponse.ok ? await statusResponse.json() : { connected: false };
        if (!status.connected || cancelled) return;
        setDriveConnected(true);
        setDriveLoading(true);
        setConnectionMessage("טוען את כל הקבצים מה־Drive…");
        const files = await fetchAllDriveFiles(data.session.access_token);
        if (!cancelled) {
          setDriveDocuments(files.map(toDocument));
          setConnectionMessage(`נטענו ${files.length} פריטים מה־Drive.`);
          history.replaceState(null, "", "/index.html");
        }
      } catch (error) {
        if (!cancelled) setConnectionMessage(error instanceof Error ? error.message : "לא הצלחנו לטעון את ה־Drive.");
      } finally { if (!cancelled) setDriveLoading(false); }
    }
    loadDrive();
    return () => { cancelled = true; };
  }, []);

  const navigate = (label: string) => {
    setActive(label);
    setMenuOpen(false);
    const target = label === "מסמכים" ? "documents" : "top";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const authClient = async () => {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error("החיבור עדיין לא הוגדר בשרת.");
    const config = await response.json();
    return createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } });
  };

  const connectGoogleDrive = async () => {
    setConnectionMessage("מתחברים…");
    try {
      const client = await authClient();
      const { data } = await client.auth.getSession();
      if (!data.session) { setShowLogin(true); setConnectionMessage(""); return; }
      const response = await fetch("/api/connections/google/start", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "לא הצלחנו להתחבר ל־Drive.");
      location.assign(result.url);
    } catch (error) { setConnectionMessage(error instanceof Error ? error.message : "לא הצלחנו להתחבר ל־Drive."); }
  };

  const sendLoginLink = async (event: React.FormEvent) => {
    event.preventDefault(); setConnectionMessage("שולחים קישור מאובטח…");
    try {
      const client = await authClient();
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/index.html` } });
      if (error) throw error;
      setShowLogin(false); setConnectionMessage("הקישור נשלח למייל. אחרי הכניסה לחץ שוב על חיבור Google Drive.");
    } catch { setConnectionMessage("לא הצלחנו לשלוח את קישור הכניסה. נסה שוב."); }
  };

  return (
    <main id="top" dir="rtl">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("בית")} aria-label="חזרה לדף הבית">
          <span className="brand-mark">מ</span><span>מרכז<span className="brand-light">שלי</span></span>
        </button>
        <nav className="desktop-nav" aria-label="ניווט ראשי">
          {["בית", "מסמכים"].map((item) => (
            <button key={item} className={active === item ? "active" : ""} onClick={() => navigate(item)}>{item}</button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="connect-button" onClick={connectGoogleDrive}><span>＋</span> חיבור מידע</button>
          <button className="icon-button" aria-label="התראות">♢<i /></button>
          <button className="avatar" aria-label="פרופיל משתמש">ש</button>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="פתיחת תפריט">
            <span /><span /><span />
          </button>
        </div>
        {menuOpen && (
          <nav className="mobile-menu" aria-label="ניווט למובייל">
            {["בית", "מסמכים"].map((item) => (
              <button key={item} className={active === item ? "active" : ""} onClick={() => navigate(item)}>{item}<span>←</span></button>
            ))}
            <button className="mobile-connect" onClick={connectGoogleDrive}>＋ חיבור מידע חדש</button>
          </nav>
        )}
      </header>

      <section className="hero">
        <div className="eyebrow"><span>✦</span> כל המידע שלך. בדיוק כמו שנוח לך.</div>
        <h1>עושים סדר ב־Drive<br /><em>תוך 5 דקות.</em></h1>
        <p>מחברים את ה־Drive, ואנחנו הופכים את כל הקבצים למרכז מידע חכם — לפי פרויקטים, אנשים ונושאים. בלי להזיז אף קובץ.</p>
        <div className="hero-actions">
          <button className="primary" onClick={connectGoogleDrive}><span className="drive-dots"><i /><i /><i /></span> חיבור Google Drive <b>←</b></button>
          <button className="text-action" onClick={() => navigate("מסמכים")}>לראות איך זה עובד <span>↓</span></button>
        </div>
        <div className="trust-row"><span>✓ לא משנים את מבנה התיקיות שלך</span><span>✓ ההרשאות נשארות בשליטתך</span></div>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <div><span className="date">{today}</span><h2>בוקר טוב 👋</h2><p>{driveConnected ? "המידע מה־Drive שלך נטען ומוכן לחיפוש." : "חבר את Google Drive כדי לראות כאן את המידע שלך."}</p></div>
          <label className="global-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש בכל המידע..." /><kbd>⌘ K</kbd></label>
        </div>

        <section id="documents" className="content-section documents-section">
          <div className="section-title documents-title"><div><span className="mini-icon violet">▤</span><h3>{driveConnected ? "כל הפריטים ב־Drive" : "המסמכים שלך"}</h3><span className="count">{driveLoading ? "טוען…" : `${driveDocuments.length} בסך הכול`}</span></div><div className="doc-controls"><label><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש במסמכים" /></label><button className="filter">☷ סינון</button></div></div>
          <div className="table-wrap"><table><thead><tr><th>שם המסמך</th><th>פרויקט</th><th>אדם</th><th>עודכן</th><th></th></tr></thead><tbody>
            {filteredDocs.map((doc) => <tr key={doc.id}><td><span className={`file-icon ${doc.tone}`}>{doc.type.slice(0,1)}</span><span><strong>{doc.title}</strong><small>{doc.type} · Google Drive</small></span></td><td><span className="tag">{doc.project}</span></td><td>{doc.person}</td><td>{doc.date}</td><td><a className="open-document" href={doc.url} target="_blank" rel="noreferrer" aria-label={`פתיחת ${doc.title}`}>פתיחה ←</a></td></tr>)}
          </tbody></table>{filteredDocs.length === 0 && <div className="empty">{driveConnected ? "לא מצאנו פריטים שמתאימים לחיפוש." : "עדיין אין כאן מידע. חבר את Google Drive כדי לטעון את הקבצים שלך."}</div>}</div>
          <button className="all-documents">לכל המסמכים <span>←</span></button>
        </section>

        <aside className="ai-strip"><div className="ai-icon">✦</div><div><span>תוספת חכמה</span><strong>רוצה לדעת מה חדש במידע שלך?</strong><p>העוזר יכול לסכם שינויים ולענות על שאלות — כשצריך.</p></div><button>פתיחת העוזר <span>←</span></button></aside>
      </section>

      <footer><button className="brand"><span className="brand-mark">מ</span><span>מרכז<span className="brand-light">שלי</span></span></button><p>המידע שלך, בדרך שלך.</p><span>Google Drive · {driveConnected ? `${driveDocuments.length} פריטים מחוברים` : "מוכן לחיבור"}</span></footer>
      {connectionMessage && <div className="connection-toast" role="status">{connectionMessage}<button onClick={() => setConnectionMessage("")} aria-label="סגירה">×</button></div>}
      {showLogin && <div className="login-overlay" role="dialog" aria-modal="true" aria-label="כניסה למרכז שלי"><form className="login-card" onSubmit={sendLoginLink}><button type="button" className="login-close" onClick={() => setShowLogin(false)} aria-label="סגירה">×</button><span className="brand-mark">מ</span><h2>כניסה לפני חיבור ה־Drive</h2><p>נשלח אליך קישור כניסה מאובטח. לאחר הכניסה אפשר לחבר את Google Drive.</p><label>כתובת אימייל<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus placeholder="name@example.com" /></label><button className="primary" type="submit">שליחת קישור כניסה</button></form></div>}
    </main>
  );
}

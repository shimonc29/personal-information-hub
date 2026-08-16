"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const projects = [
  { name: "השקת סדנת AI", meta: "12 מסמכים", color: "coral", icon: "✦" },
  { name: "אתר חדש לעסק", meta: "8 מסמכים", color: "blue", icon: "◫" },
  { name: "שיפוץ הבית", meta: "6 מסמכים", color: "green", icon: "⌂" },
];

const people = [
  { name: "נועה לוי", role: "עיצוב ומיתוג", initials: "נל", color: "pink" },
  { name: "אורי כהן", role: "פיתוח האתר", initials: "אכ", color: "teal" },
  { name: "דנה בר", role: "הנהלת חשבונות", initials: "דב", color: "yellow" },
  { name: "רון אביב", role: "ספק", initials: "רא", color: "violet" },
];

const documents = [
  { title: "הצעת מחיר — אתר חדש", type: "PDF", project: "אתר חדש לעסק", person: "אורי כהן", date: "היום, 10:42", tone: "pdf" },
  { title: "תוכנית עבודה לסדנה", type: "DOC", project: "השקת סדנת AI", person: "נועה לוי", date: "אתמול", tone: "doc" },
  { title: "תקציב שיפוץ מעודכן", type: "XLS", project: "שיפוץ הבית", person: "רון אביב", date: "12 באוג׳", tone: "xls" },
  { title: "בריף שפה חזותית", type: "SLD", project: "השקת סדנת AI", person: "נועה לוי", date: "10 באוג׳", tone: "sld" },
];

const categories = [
  { label: "הצעות מחיר", count: 14, symbol: "₪", color: "mint" },
  { label: "חשבוניות", count: 23, symbol: "≋", color: "peach" },
  { label: "חוזים", count: 7, symbol: "✎", color: "lavender" },
  { label: "מצגות", count: 9, symbol: "▤", color: "sky" },
];

const topics = ["בינה מלאכותית", "שיווק", "פיננסים", "עיצוב", "לקוחות", "בית ומשפחה"];

export default function Home() {
  const [active, setActive] = useState("בית");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [email, setEmail] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  const filteredDocs = useMemo(() => documents.filter((d) =>
    `${d.title} ${d.project} ${d.person}`.includes(query.trim())
  ), [query]);

  const navigate = (label: string) => {
    setActive(label);
    setMenuOpen(false);
    const target = label === "מסמכים" ? "documents" : label === "פרויקטים" ? "projects" : "top";
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
          {["בית", "מסמכים", "פרויקטים", "אנשים"].map((item) => (
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
            {["בית", "מסמכים", "פרויקטים", "אנשים"].map((item) => (
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
          <div><span className="date">יום ראשון, 16 באוגוסט</span><h2>בוקר טוב 👋</h2><p>המידע שלך מסודר ומחכה לך.</p></div>
          <label className="global-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש בכל המידע..." /><kbd>⌘ K</kbd></label>
        </div>

        <section id="projects" className="content-section">
          <div className="section-title"><div><span className="mini-icon coral">◈</span><h3>הפרויקטים שלי</h3><span className="count">3 פעילים</span></div><button onClick={() => setShowAll(!showAll)}>{showAll ? "הצג פחות" : "לכל הפרויקטים"} ←</button></div>
          <div className="project-grid">
            {projects.map((p, index) => <button className={`project-card ${p.color}`} key={p.name} onClick={() => setQuery(p.name)}>
              <span className="project-icon">{p.icon}</span><span className="project-name">{p.name}</span><span className="project-meta">{p.meta} · עודכן {index === 0 ? "היום" : index === 1 ? "אתמול" : "השבוע"}</span><span className="arrow">←</span>
            </button>)}
            <button className="project-card add-project"><span>＋</span><strong>פרויקט חדש</strong><small>אספו מידע במקום אחד</small></button>
          </div>
        </section>

        <div className="two-columns">
          <section className="content-section people-section">
            <div className="section-title"><div><span className="mini-icon blue">♙</span><h3>אנשים</h3></div><button>לכל האנשים ←</button></div>
            <div className="people-list">
              {people.map((person) => <button key={person.name} onClick={() => setQuery(person.name)}><span className={`person-avatar ${person.color}`}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.role}</small></span><b>←</b></button>)}
            </div>
          </section>
          <section className="content-section types-section">
            <div className="section-title"><div><span className="mini-icon green">▱</span><h3>סוגי מסמכים</h3></div><button onClick={() => navigate("מסמכים")}>לכל המסמכים ←</button></div>
            <div className="category-grid">{categories.map((c) => <button className={c.color} key={c.label} onClick={() => setQuery(c.label)}><span>{c.symbol}</span><strong>{c.label}</strong><small>{c.count} מסמכים</small></button>)}</div>
          </section>
        </div>

        <section id="documents" className="content-section documents-section">
          <div className="section-title documents-title"><div><span className="mini-icon violet">▤</span><h3>מסמכים אחרונים</h3><span className="count">68 בסך הכול</span></div><div className="doc-controls"><label><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש במסמכים" /></label><button className="filter">☷ סינון</button></div></div>
          <div className="table-wrap"><table><thead><tr><th>שם המסמך</th><th>פרויקט</th><th>אדם</th><th>עודכן</th><th></th></tr></thead><tbody>
            {filteredDocs.map((doc) => <tr key={doc.title}><td><span className={`file-icon ${doc.tone}`}>{doc.type.slice(0,1)}</span><span><strong>{doc.title}</strong><small>{doc.type} · Google Drive</small></span></td><td><span className="tag">{doc.project}</span></td><td>{doc.person}</td><td>{doc.date}</td><td><button aria-label={`אפשרויות עבור ${doc.title}`}>•••</button></td></tr>)}
          </tbody></table>{filteredDocs.length === 0 && <div className="empty">לא מצאנו מסמכים שמתאימים לחיפוש.</div>}</div>
          <button className="all-documents">לכל המסמכים <span>←</span></button>
        </section>

        <section className="topics-section"><div className="section-title"><div><span className="mini-icon yellow">#</span><h3>נושאים שמעניינים אותי</h3></div><button>עריכת נושאים</button></div><div className="topic-list">{topics.map((topic, i) => <button onClick={() => setQuery(topic)} key={topic}><span className={`topic-dot d${i}`} />{topic}<small>{[18,12,9,15,21,7][i]}</small></button>)}</div></section>

        <aside className="ai-strip"><div className="ai-icon">✦</div><div><span>תוספת חכמה</span><strong>רוצה לדעת מה חדש במידע שלך?</strong><p>העוזר יכול לסכם שינויים ולענות על שאלות — כשצריך.</p></div><button>פתיחת העוזר <span>←</span></button></aside>
      </section>

      <footer><button className="brand"><span className="brand-mark">מ</span><span>מרכז<span className="brand-light">שלי</span></span></button><p>המידע שלך, בדרך שלך.</p><span>Google Drive · מוכן לחיבור</span></footer>
      {connectionMessage && <div className="connection-toast" role="status">{connectionMessage}<button onClick={() => setConnectionMessage("")} aria-label="סגירה">×</button></div>}
      {showLogin && <div className="login-overlay" role="dialog" aria-modal="true" aria-label="כניסה למרכז שלי"><form className="login-card" onSubmit={sendLoginLink}><button type="button" className="login-close" onClick={() => setShowLogin(false)} aria-label="סגירה">×</button><span className="brand-mark">מ</span><h2>כניסה לפני חיבור ה־Drive</h2><p>נשלח אליך קישור כניסה מאובטח. לאחר הכניסה אפשר לחבר את Google Drive.</p><label>כתובת אימייל<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus placeholder="name@example.com" /></label><button className="primary" type="submit">שליחת קישור כניסה</button></form></div>}
    </main>
  );
}

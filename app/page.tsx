"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { fetchAllDriveFiles, toDocument } from "@/lib/drive-client.mjs";

const navigationTargets: Record<string, string> = { "בית": "top", "יועץ AI": "ai-advisor", "פרויקטים": "projects", "מסמכים": "documents" };

export default function Home() {
  const [active, setActive] = useState("בית");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [email, setEmail] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [advisorMessages, setAdvisorMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [driveDocuments, setDriveDocuments] = useState<ReturnType<typeof toDocument>[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string; description: string }[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ fileId: string; projectId: string; reason: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

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
        setAccessToken(data.session.access_token);
        const authHeaders = { Authorization: `Bearer ${data.session.access_token}` };
        const [projectsResponse, assignmentsResponse] = await Promise.all([fetch("/api/projects", { headers: authHeaders }), fetch("/api/document-projects", { headers: authHeaders })]);
        if (projectsResponse.ok && !cancelled) setProjects((await projectsResponse.json()).projects ?? []);
        if (assignmentsResponse.ok && !cancelled) setAssignments((await assignmentsResponse.json()).assignments ?? {});
        const statusResponse = await fetch("/api/connections/google/status", { headers: authHeaders });
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
    const target = navigationTargets[label] ?? "top";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openAdvisor = () => {
    setShowAdvisor(true);
    navigate("יועץ AI");
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

  const submitAdvisorQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = advisorQuestion.trim();
    if (!question || advisorLoading) return;
    setAdvisorQuestion("");
    setAdvisorMessages((messages) => [...messages, { role: "user", text: question }]);
    setAdvisorLoading(true);
    try {
      const client = await authClient();
      const { data } = await client.auth.getSession();
      if (!data.session) throw new Error("צריך להיכנס ולחבר את Google Drive לפני ששואלים את היועץ.");
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "לא הצלחנו לקבל תשובה.");
      setAdvisorMessages((messages) => [...messages, { role: "assistant", text: result.answer }]);
    } catch (error) {
      setAdvisorMessages((messages) => [...messages, { role: "assistant", text: error instanceof Error ? error.message : "לא הצלחנו לקבל תשובה." }]);
    } finally { setAdvisorLoading(false); }
  };

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault(); if (!accessToken || projectSaving) return; setProjectSaving(true);
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ name: projectName, description: projectDescription }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setProjects((items) => [result.project, ...items]); setProjectName(""); setProjectDescription(""); setShowProjectForm(false); setConnectionMessage("הפרויקט נוצר.");
    } catch { setConnectionMessage("לא הצלחנו ליצור את הפרויקט."); } finally { setProjectSaving(false); }
  };

  const saveDocumentProject = async (fileId: string, projectId: string) => {
    const previous = assignments[fileId]; setAssignments((items) => ({ ...items, [fileId]: projectId }));
    try {
      const response = await fetch("/api/document-projects", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ fileId, projectId: projectId || null }) });
      if (!response.ok) throw new Error();
    } catch { setAssignments((items) => ({ ...items, [fileId]: previous ?? "" })); setConnectionMessage("לא הצלחנו לשמור את השיוך."); }
  };

  const requestProjectSuggestions = async () => {
    if (!accessToken || suggestionsLoading) return; setSuggestionsLoading(true);
    try { const response = await fetch("/api/ai/project-suggestions", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json(); if (!response.ok) throw new Error(); setSuggestions(result.suggestions ?? []); if (!(result.suggestions ?? []).length) setConnectionMessage("לא נמצאו הצעות שיוך בטוחות."); }
    catch { setConnectionMessage("לא הצלחנו ליצור הצעות שיוך."); } finally { setSuggestionsLoading(false); }
  };

  const approveSuggestions = async () => {
    await Promise.all(suggestions.map((suggestion) => saveDocumentProject(suggestion.fileId, suggestion.projectId))); setSuggestions([]); setConnectionMessage("הצעות השיוך נשמרו.");
  };

  return (
    <main id="top" dir="rtl">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("בית")} aria-label="חזרה לדף הבית">
          <span className="brand-mark">מ</span><span>מרכז<span className="brand-light">שלי</span></span>
        </button>
        <nav className="desktop-nav" aria-label="ניווט ראשי">
          {["בית", "יועץ AI", "פרויקטים", "מסמכים"].map((item) => (
            <button key={item} className={active === item ? "active" : ""} onClick={() => item === "יועץ AI" ? openAdvisor() : navigate(item)}>{item}</button>
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
            {["בית", "יועץ AI", "פרויקטים", "מסמכים"].map((item) => (
              <button key={item} className={active === item ? "active" : ""} onClick={() => item === "יועץ AI" ? openAdvisor() : navigate(item)}>{item}<span>←</span></button>
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

        <aside id="ai-advisor" className="ai-strip ai-strip-top"><div className="ai-icon">✦</div><div><span>יועץ AI</span><strong>שאלות ותובנות על המידע שלך</strong><p>היועץ נמצא תמיד בראש מרכז המידע, ונפתח מכאן או מהתפריט העליון.</p></div><button onClick={openAdvisor}>פתיחת היועץ <span>←</span></button></aside>

        <section id="projects" className="content-section projects-live"><div className="section-title"><div><span className="mini-icon coral">◈</span><h3>הפרויקטים שלי</h3><span className="count">{projects.length}</span></div><div className="project-actions"><button onClick={requestProjectSuggestions} disabled={!projects.length || suggestionsLoading}>{suggestionsLoading ? "מכין הצעות…" : "הצעות שיוך עם AI"}</button><button className="new-project-button" onClick={() => setShowProjectForm(true)}>＋ יצירת פרויקט</button></div></div>{projects.length ? <div className="live-project-list">{projects.map((project) => <article key={project.id}><span className="project-icon">{project.name.charAt(0)}</span><div><strong>{project.name}</strong><p>{project.description || "ללא תיאור"}</p><small>{Object.values(assignments).filter((id) => id === project.id).length} פריטים משויכים</small></div></article>)}</div> : <div className="empty project-empty">עדיין אין פרויקטים. צור את הפרויקט הראשון ושייך אליו מסמכים מה־Drive.</div>}{suggestions.length > 0 && <div className="suggestions-box"><strong>הצעות AI לשיוך</strong>{suggestions.map((suggestion) => { const file = driveDocuments.find((item) => item.id === suggestion.fileId); const project = projects.find((item) => item.id === suggestion.projectId); return <div key={suggestion.fileId}><span>{file?.title} ← {project?.name}</span><small>{suggestion.reason}</small></div> })}<button className="new-project-button" onClick={approveSuggestions}>אישור ההצעות</button></div>}</section>

        <section id="documents" className="content-section documents-section">
          <div className="section-title documents-title"><div><span className="mini-icon violet">▤</span><h3>{driveConnected ? "כל הפריטים ב־Drive" : "המסמכים שלך"}</h3><span className="count">{driveLoading ? "טוען…" : `${driveDocuments.length} בסך הכול`}</span></div><div className="doc-controls"><label><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש במסמכים" /></label><button className="filter">☷ סינון</button></div></div>
          <div className="table-wrap"><table><thead><tr><th>שם המסמך</th><th>פרויקט</th><th>עודכן</th><th></th></tr></thead><tbody>
            {filteredDocs.map((doc) => <tr key={doc.id}><td><span className={`file-icon ${doc.tone}`}>{doc.type.slice(0,1)}</span><span><strong>{doc.title}</strong><small>{doc.type} · Google Drive</small></span></td><td><select className="project-select" value={assignments[doc.id] ?? ""} onChange={(event) => saveDocumentProject(doc.id, event.target.value)} aria-label={`שיוך ${doc.title} לפרויקט`}><option value="">ללא פרויקט</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></td><td>{doc.date}</td><td><a className="open-document" href={doc.url} target="_blank" rel="noreferrer" aria-label={`פתיחת ${doc.title}`}>פתיחה ←</a></td></tr>)}
          </tbody></table>{filteredDocs.length === 0 && <div className="empty">{driveConnected ? "לא מצאנו פריטים שמתאימים לחיפוש." : "עדיין אין כאן מידע. חבר את Google Drive כדי לטעון את הקבצים שלך."}</div>}</div>
          <button className="all-documents">לכל המסמכים <span>←</span></button>
        </section>

      </section>

      <footer><button className="brand"><span className="brand-mark">מ</span><span>מרכז<span className="brand-light">שלי</span></span></button><p>המידע שלך, בדרך שלך.</p><span>Google Drive · {driveConnected ? `${driveDocuments.length} פריטים מחוברים` : "מוכן לחיבור"}</span></footer>
      {connectionMessage && <div className="connection-toast" role="status">{connectionMessage}<button onClick={() => setConnectionMessage("")} aria-label="סגירה">×</button></div>}
      {showLogin && <div className="login-overlay" role="dialog" aria-modal="true" aria-label="כניסה למרכז שלי"><form className="login-card" onSubmit={sendLoginLink}><button type="button" className="login-close" onClick={() => setShowLogin(false)} aria-label="סגירה">×</button><span className="brand-mark">מ</span><h2>כניסה לפני חיבור ה־Drive</h2><p>נשלח אליך קישור כניסה מאובטח. לאחר הכניסה אפשר לחבר את Google Drive.</p><label>כתובת אימייל<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus placeholder="name@example.com" /></label><button className="primary" type="submit">שליחת קישור כניסה</button></form></div>}
      {showAdvisor && <div className="login-overlay" role="dialog" aria-modal="true" aria-label="יועץ AI"><section className="login-card advisor-card"><button type="button" className="login-close" onClick={() => setShowAdvisor(false)} aria-label="סגירה">×</button><span className="brand-mark">✦</span><h2>יועץ AI</h2><p>שאל על שמות הקבצים, הסוגים ותאריכי העדכון ב־Drive. היועץ לא קורא עדיין את תוכן הקבצים עצמם.</p><div className="advisor-messages" aria-live="polite">{advisorMessages.length === 0 && <div className="advisor-empty">אפשר לשאול למשל: אילו קבצים עודכנו לאחרונה?</div>}{advisorMessages.map((message, index) => <div key={index} className={`advisor-message ${message.role}`}>{message.text}</div>)}{advisorLoading && <div className="advisor-message assistant">חושב…</div>}</div><form className="advisor-form" onSubmit={submitAdvisorQuestion}><label htmlFor="advisor-question">שאל שאלה על הקבצים שלך</label><textarea id="advisor-question" value={advisorQuestion} onChange={(event) => setAdvisorQuestion(event.target.value)} maxLength={1000} required placeholder="מה השתנה לאחרונה ב־Drive?" /><button className="primary" type="submit" disabled={advisorLoading}>{advisorLoading ? "שולח…" : "שליחה"}</button></form></section></div>}
      {showProjectForm && <div className="login-overlay" role="dialog" aria-modal="true" aria-label="יצירת פרויקט"><form className="login-card" onSubmit={createProject}><button type="button" className="login-close" onClick={() => setShowProjectForm(false)} aria-label="סגירה">×</button><span className="brand-mark">◈</span><h2>יצירת פרויקט</h2><label>שם הפרויקט<input value={projectName} onChange={(event) => setProjectName(event.target.value)} required maxLength={200} autoFocus /></label><label>תיאור<textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={2000} placeholder="מה שייך לפרויקט הזה?" /></label><button className="primary" type="submit" disabled={projectSaving}>{projectSaving ? "שומר…" : "יצירת פרויקט"}</button></form></div>}
    </main>
  );
}

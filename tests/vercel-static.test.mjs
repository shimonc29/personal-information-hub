import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel serves the real application at /index.html without an iframe", async () => {
  const [configText, packageText] = await Promise.all([
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(configText);
  const packageJson = JSON.parse(packageText);

  assert.equal(packageJson.scripts.build, "next build");
  assert.ok(packageJson.dependencies.next);
  assert.deepEqual(config.rewrites, [{ source: "/index.html", destination: "/" }]);
  await assert.rejects(readFile(new URL("../public/index.html", import.meta.url), "utf8"), { code: "ENOENT" });
});

test("the greeting does not expose a hard-coded user name", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(page, /בוקר טוב, שימון/);
  assert.match(page, /בוקר טוב 👋/);
});

test("Google Drive buttons use the real OAuth connection flow", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /connectGoogleDrive/);
  assert.match(page, /onClick=\{connectGoogleDrive\}/);
  assert.match(page, /\/api\/connections\/google\/start/);
  assert.match(page, /createClient/);
});

test("Google Drive API routes return to the new application", async () => {
  const routes = [
    "../app/api/config/route.ts",
    "../app/api/connections/google/start/route.ts",
    "../app/api/connections/google/status/route.ts",
    "../app/api/connections/google/callback/route.ts",
    "../app/api/drive/files/route.ts",
  ];
  await Promise.all(routes.map((route) => access(new URL(route, import.meta.url))));

  const callback = await readFile(new URL("../app/api/connections/google/callback/route.ts", import.meta.url), "utf8");
  assert.match(callback, /\/index\.html\?google=connected/);
  assert.match(callback, /\/index\.html\?google=error/);
});

test("the document screen loads and renders connected Drive files", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /fetchAllDriveFiles/);
  assert.match(page, /useEffect/);
  assert.match(page, /driveDocuments\.length/);
  assert.match(page, /href=\{doc\.url\}/);
  assert.match(page, /טוען את כל הקבצים מה־Drive/);
});

test("the information hub never renders invented sample data", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  for (const inventedValue of ["השקת סדנת AI", "אתר חדש לעסק", "שיפוץ הבית", "נועה לוי", "אורי כהן", "דנה בר", "רון אביב", "16 באוגוסט"]) {
    assert.doesNotMatch(page, new RegExp(inventedValue));
  }
  assert.doesNotMatch(page, /const (projects|people|documents|categories|topics) =/);
  assert.match(page, /driveConnected \? driveDocuments : \[\]/);
  assert.match(page, /toLocaleDateString\("he-IL"/);
});

test("top navigation maps every button to a real section", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const navigationTargets/);
  assert.match(page, /"יועץ AI": "ai-advisor"/);
  assert.match(page, /\["בית", "יועץ AI", "פרויקטים", "מסמכים"\]/);
  assert.match(page, /id="ai-advisor"/);
  assert.match(page, /onClick=\{openAdvisor\}/);
});

test("the AI advisor is above the document list", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const advisorIndex = page.indexOf('id="ai-advisor"');
  const documentsIndex = page.indexOf('id="documents"');

  assert.ok(advisorIndex > 0 && advisorIndex < documentsIndex);
  assert.match(page, /showAdvisor/);
});

test("the AI advisor uses a protected server route and real chat form", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  await access(new URL("../app/api/ai/chat/route.ts", import.meta.url));
  await access(new URL("../app/api/ai/status/route.ts", import.meta.url));

  assert.match(page, /submitAdvisorQuestion/);
  assert.match(page, /\/api\/ai\/chat/);
  assert.match(page, /advisorMessages/);
  assert.match(page, /שאל שאלה על הקבצים שלך/);
  assert.doesNotMatch(page, /יועץ ה־AI עדיין לא מחובר למודל/);
});

test("projects can be created and Drive documents can be assigned", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const route of ["../app/api/projects/route.ts", "../app/api/document-projects/route.ts", "../app/api/ai/project-suggestions/route.ts"]) await access(new URL(route, import.meta.url));

  assert.match(page, /יצירת פרויקט/);
  assert.match(page, /createProject/);
  assert.match(page, /saveDocumentProject/);
  assert.match(page, /הצעות שיוך עם AI/);
  assert.match(page, /אישור ההצעות/);
});

test("projects can be edited, removed, and created as subprojects", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8");
  assert.match(page, /עריכת פרויקט/);
  assert.match(page, /יצירת תת־פרויקט/);
  assert.match(page, /מחיקת פרויקט/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
});

test("the create-project button has a visible high-specificity style", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.project-actions \.new-project-button\s*\{[^}]*background:var\(--green\)!important[^}]*color:white!important/);
});

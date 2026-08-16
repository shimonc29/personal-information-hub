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

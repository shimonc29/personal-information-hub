import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

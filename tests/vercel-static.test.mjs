import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel serves the personal information hub at /index.html", async () => {
  const [html, configText] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(configText);

  assert.match(html, /מרכזשלי/);
  assert.match(html, /merkaz-sheli-v2\.shimonc29\.chatgpt\.site/);
  assert.equal(config.outputDirectory, "public");
  assert.equal(config.framework, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { selectRelevantFiles, askOpenAI } from "../lib/ai-advisor.mjs";

const files = [
  { id: "1", name: "תקציב פרויקט אלפא", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-08-16T10:00:00Z", webViewLink: "https://drive.google.com/1" },
  { id: "2", name: "תמונה לחופשה", mimeType: "image/jpeg", modifiedTime: "2026-01-01T10:00:00Z", webViewLink: "https://drive.google.com/2" },
];

test("selectRelevantFiles prioritizes matching Drive metadata", () => {
  const selected = selectRelevantFiles(files, "מה התקציב של פרויקט אלפא?");
  assert.equal(selected[0].id, "1");
  assert.equal(selected[0].webViewLink, "https://drive.google.com/1");
});

test("askOpenAI sends a grounded Hebrew request through Responses API", async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: "מצאתי תקציב." }] }] }));
  };

  const answer = await askOpenAI({ apiKey: "secret", model: "gpt-test", question: "מה התקציב?", files, fetchImpl });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.init.headers.Authorization, "Bearer secret");
  assert.equal(request.body.model, "gpt-test");
  assert.match(request.body.instructions, /ענה בעברית/);
  assert.match(request.body.input, /תקציב פרויקט אלפא/);
  assert.equal(answer, "מצאתי תקציב.");
});

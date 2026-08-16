function words(value) {
  return String(value).toLocaleLowerCase("he-IL").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}

export function selectRelevantFiles(files, question, limit = 80) {
  const terms = new Set(words(question));
  return [...files].map((file) => {
    const nameWords = words(file.name);
    const matches = nameWords.filter((word) => terms.has(word)).length;
    return { file, score: matches * 1000 + (new Date(file.modifiedTime ?? 0).getTime() / 1e13) };
  }).sort((a, b) => b.score - a.score).slice(0, limit).map(({ file }) => file);
}

function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  return payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

export async function askOpenAI({ apiKey, model, question, files, fetchImpl = fetch }) {
  const relevant = selectRelevantFiles(files, question);
  const context = relevant.map((file, index) => `${index + 1}. ${file.name} | ${file.mimeType ?? "לא ידוע"} | עודכן: ${file.modifiedTime ?? "לא ידוע"} | ${file.webViewLink ?? "ללא קישור"}`).join("\n");
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: "ענה בעברית ובקצרה כיועץ מידע אישי. הסתמך רק על מטא־דאטה של קובצי Google Drive שסופק. אל תטען שקראת את תוכן הקבצים. כשאפשר, ציין את שם הקובץ והקישור. אם אין מספיק מידע, אמור זאת בבירור.",
      input: `שאלת המשתמש:\n${question}\n\nקבצים רלוונטיים מה־Drive:\n${context || "לא נמצאו קבצים"}`,
      max_output_tokens: 700,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || "OpenAI request failed"), { statusCode: response.status === 429 ? 429 : 502 });
  const text = responseText(payload);
  if (!text) throw Object.assign(new Error("OpenAI returned no answer"), { statusCode: 502 });
  return text;
}

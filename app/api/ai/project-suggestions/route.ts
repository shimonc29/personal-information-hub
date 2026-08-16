import { bearer, listGoogleDriveFiles } from "@/lib/google-drive";
import { listProjects } from "@/lib/project-store";
import { parseAssignmentSuggestions } from "@/lib/projects.mjs";

export async function POST(request: Request) {
  try {
    const token = bearer(request); if (!token) return Response.json({ error: "Authentication is required" }, { status: 401 });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI is not configured" }, { status: 503 });
    const [projects, drive] = await Promise.all([listProjects(token), listGoogleDriveFiles(token)]);
    if (!projects.length) return Response.json({ suggestions: [] });
    const files = (drive.files ?? []).slice(0, 300);
    const prompt = `הצע שיוך של קבצי Drive לפרויקטים לפי דמיון בשם ובהקשר. החזר אך ורק מערך JSON של {"fileId","projectId","reason"}. אל תציע שיוך כשאין התאמה סבירה.\nפרויקטים:\n${projects.map((p) => `${p.id}|${p.name}|${p.description}`).join("\n")}\nקבצים:\n${files.map((f: { id: string; name: string; mimeType?: string }) => `${f.id}|${f.name}|${f.mimeType ?? ""}`).join("\n")}`;
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions: "ענה רק ב־JSON תקין.", input: prompt, max_output_tokens: 1500 }) });
    const payload = await response.json();
    const text = payload.output_text ?? payload.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content ?? []).find((item: { type: string }) => item.type === "output_text")?.text ?? "[]";
    if (!response.ok) throw new Error("AI request failed");
    return Response.json({ suggestions: parseAssignmentSuggestions(text, new Set(files.map((file: { id: string }) => file.id)), new Set(projects.map((project: { id: string }) => project.id))) });
  } catch { return Response.json({ error: "לא הצלחנו ליצור הצעות שיוך." }, { status: 500 }); }
}

import { askOpenAI } from "@/lib/ai-advisor.mjs";
import { apiError, bearer, listGoogleDriveFiles } from "@/lib/google-drive";

export async function POST(request: Request) {
  try {
    const token = bearer(request);
    if (!token) return Response.json({ error: "Authentication is required" }, { status: 401 });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI is not configured" }, { status: 503 });
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 1000) return Response.json({ error: "Question must contain 1-1000 characters" }, { status: 400 });
    const files = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await listGoogleDriveFiles(token, pageToken);
      files.push(...(result.files ?? []));
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    const answer = await askOpenAI({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-4.1-mini", question, files });
    return Response.json({ answer });
  } catch (error) {
    const value = error as { statusCode?: number; message?: string };
    if (value.statusCode === 429) return Response.json({ error: "מגבלת השימוש ב־AI הושגה. נסה שוב בעוד רגע." }, { status: 429 });
    return apiError(error);
  }
}

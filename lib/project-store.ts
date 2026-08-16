import { validateProject } from "@/lib/projects.mjs";
export type Project = { id: string; name: string; description: string; status: string };

function config() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) throw Object.assign(new Error("Storage is not configured"), { statusCode: 503 });
  return { url: process.env.SUPABASE_URL.replace(/\/$/, ""), key };
}

async function request(path: string, token: string, init: RequestInit = {}) {
  const c = config();
  const response = await fetch(`${c.url}/rest/v1/${path}`, { ...init, headers: { apikey: c.key, Authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers } });
  if (!response.ok) throw Object.assign(new Error(`Project storage failed (${response.status})`), { statusCode: response.status });
  const text = await response.text(); return text ? JSON.parse(text) : null;
}

export async function listProjects(token: string): Promise<Project[]> {
  const rows = await request("projects?select=id,name,description,status,created_at&status=neq.archived&order=updated_at.desc", token);
  return rows.map((row: Record<string, unknown>) => ({ id: row.id, name: row.name, description: row.description ?? "", status: row.status }));
}

export async function createProject(token: string, input: unknown) {
  const draft = validateProject(input);
  const slug = `project-${crypto.randomUUID().slice(0, 12)}`;
  const rows = await request("projects", token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...draft, slug, status: "active", status_label: "פעיל", tone: "blue", updated_label: "היום" }) });
  const row = rows[0]; return { id: row.id, name: row.name, description: row.description ?? "", status: row.status };
}

export async function listDocumentProjects(token: string) {
  const rows = await request("document_workflows?select=drive_file_id,project_id&project_id=not.is.null", token);
  return Object.fromEntries(rows.map((row: Record<string, string>) => [row.drive_file_id, row.project_id]));
}

export async function saveDocumentProject(token: string, input: { fileId?: string; projectId?: string | null }) {
  if (!input.fileId || input.fileId.length > 500) throw Object.assign(new Error("File ID is invalid"), { statusCode: 400 });
  if (!input.projectId) { await request(`document_workflows?drive_file_id=eq.${encodeURIComponent(input.fileId)}`, token, { method: "DELETE" }); return; }
  await request("document_workflows?on_conflict=user_id%2Cdrive_file_id", token, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ drive_file_id: input.fileId, project_id: input.projectId, next_action: "", handled: false }) });
}

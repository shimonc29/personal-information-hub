import { validateProject } from "@/lib/projects.mjs";
export type Project = { id: string; name: string; description: string; status: string; parentProjectId: string };

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
  const rows = await request("projects?select=id,name,description,status,client,created_at&status=neq.archived&order=updated_at.desc", token);
  return rows.map((row: Record<string, unknown>) => ({ id: row.id, name: row.name, description: row.description ?? "", status: row.status, parentProjectId: row.client ?? "" }));
}

export async function createProject(token: string, input: unknown) {
  const draft = validateProject(input);
  const slug = `project-${crypto.randomUUID().slice(0, 12)}`;
  const { parentProjectId = "", ...fields } = draft;
  const rows = await request("projects", token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...fields, client: parentProjectId, slug, status: "active", status_label: "פעיל", tone: "blue", updated_label: "היום" }) });
  const row = rows[0]; return { id: row.id, name: row.name, description: row.description ?? "", status: row.status, parentProjectId: row.client ?? parentProjectId };
}

export async function updateProject(token: string, input: { id?: string; name?: string; description?: string; parentProjectId?: string }) {
  if (!input.id) throw Object.assign(new Error("Project ID is required"), { statusCode: 400 });
  if (input.parentProjectId === input.id) throw Object.assign(new Error("A project cannot contain itself"), { statusCode: 400 });
  const draft = validateProject(input);
  const { parentProjectId = "", ...fields } = draft;
  const rows = await request(`projects?id=eq.${encodeURIComponent(input.id)}`, token, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...fields, client: parentProjectId, updated_at: new Date().toISOString() }) });
  if (!rows?.length) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const row = rows[0]; return { id: row.id, name: row.name, description: row.description ?? "", status: row.status, parentProjectId: row.client ?? "" };
}

export async function deleteProject(token: string, id: string) {
  if (!id) throw Object.assign(new Error("Project ID is required"), { statusCode: 400 });
  const rows = await request(`projects?id=eq.${encodeURIComponent(id)}&select=id,client`, token);
  if (!rows?.length) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  await request(`projects?client=eq.${encodeURIComponent(id)}`, token, { method: "PATCH", body: JSON.stringify({ client: rows[0].client ?? "" }) });
  await request(`projects?id=eq.${encodeURIComponent(id)}`, token, { method: "DELETE" });
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

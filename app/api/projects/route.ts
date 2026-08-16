import { bearer } from "@/lib/google-drive";
import { createProject, listProjects } from "@/lib/project-store";
function errorResponse(error: unknown) { const value = error as { statusCode?: number }; return Response.json({ error: "לא הצלחנו לשמור את הפרויקט." }, { status: value.statusCode ?? 500 }); }
export async function GET(request: Request) { try { const token = bearer(request); if (!token) return Response.json({ error: "Authentication is required" }, { status: 401 }); return Response.json({ projects: await listProjects(token) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const token = bearer(request); if (!token) return Response.json({ error: "Authentication is required" }, { status: 401 }); return Response.json({ project: await createProject(token, await request.json()) }, { status: 201 }); } catch (error) { return errorResponse(error); } }

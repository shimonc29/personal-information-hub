import { apiError, bearer, googleDriveStatus } from "@/lib/google-drive";
export async function GET(request: Request) { try { const token = bearer(request); if (!token) return Response.json({ error: "Authentication is required" }, { status: 401 }); return Response.json(await googleDriveStatus(token)); } catch (error) { return apiError(error); } }

import { apiError, bearer, startGoogleDrive } from "@/lib/google-drive";
export async function POST(request: Request) { try { const token = bearer(request); if (!token) return Response.json({ error: "Authentication is required" }, { status: 401 }); return Response.json(await startGoogleDrive(token)); } catch (error) { return apiError(error); } }

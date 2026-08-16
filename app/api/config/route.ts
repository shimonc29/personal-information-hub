export function GET() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) return Response.json({ error: "Authentication is not configured" }, { status: 503 });
  return Response.json({ supabaseUrl: process.env.SUPABASE_URL, supabaseAnonKey: key });
}

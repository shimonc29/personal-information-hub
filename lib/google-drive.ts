import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type Secret = { ciphertext: string; iv: string; tag: string };

function config() {
  const encryptionKey = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.SUPABASE_URL || !supabaseKey || encryptionKey.length !== 32) {
    throw Object.assign(new Error("Google Drive is not configured"), { statusCode: 503 });
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "https://personal-information-hub.vercel.app/api/connections/google/callback",
    supabaseUrl: process.env.SUPABASE_URL.replace(/\/$/, ""),
    supabaseKey,
    encryptionKey,
  };
}

function encrypt(value: string, key: Buffer): Secret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  return { ciphertext: Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decrypt(value: Secret, key: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

async function supabase(path: string, token: string, init: RequestInit = {}) {
  const c = config();
  const response = await fetch(`${c.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: c.supabaseKey, Authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers } });
  if (!response.ok) throw Object.assign(new Error("Connection storage failed"), { statusCode: response.status });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function userFor(token: string) {
  const c = config();
  const response = await fetch(`${c.supabaseUrl}/auth/v1/user`, { headers: { apikey: c.supabaseKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw Object.assign(new Error("Authentication is required"), { statusCode: 401 });
  return response.json() as Promise<{ id: string }>;
}

async function connection(userId: string, token: string) {
  return (await supabase(`google_connections?user_id=eq.${encodeURIComponent(userId)}&select=*`, token))[0] ?? null;
}

export async function startGoogleDrive(token: string) {
  const c = config();
  const user = await userFor(token);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  await supabase(`google_oauth_states?user_id=eq.${encodeURIComponent(user.id)}`, token, { method: "DELETE" });
  const session = encrypt(token, c.encryptionKey);
  await supabase("google_oauth_states", token, { method: "POST", body: JSON.stringify({ user_id: user.id, state_hash: stateHash, session_token_ciphertext: session.ciphertext, session_token_iv: session.iv, session_token_tag: session.tag, code_verifier: verifier, expires_at: new Date(Date.now() + 300_000).toISOString() }) });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  Object.entries({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: "code", scope: DRIVE_SCOPE, access_type: "offline", include_granted_scopes: "true", prompt: "consent", state, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") }).forEach(([key, value]) => url.searchParams.set(key, value));
  return { url: url.toString() };
}

export async function completeGoogleDrive(state: string, code: string) {
  const c = config();
  const response = await fetch(`${c.supabaseUrl}/rest/v1/rpc/consume_google_oauth_state`, { method: "POST", headers: { apikey: c.supabaseKey, Authorization: `Bearer ${c.supabaseKey}`, "content-type": "application/json" }, body: JSON.stringify({ p_state_hash: createHash("sha256").update(state).digest("hex") }) });
  const row = response.ok ? (await response.json())[0] : null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw Object.assign(new Error("Invalid OAuth state"), { statusCode: 400 });
  const token = decrypt({ ciphertext: row.session_token_ciphertext, iv: row.session_token_iv, tag: row.session_token_tag }, c.encryptionKey);
  const exchange = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri, grant_type: "authorization_code", code_verifier: row.code_verifier }) });
  const tokens = await exchange.json();
  if (!exchange.ok || !tokens.access_token || !tokens.scope?.split(" ").includes(DRIVE_SCOPE)) throw Object.assign(new Error("Google token exchange failed"), { statusCode: 502 });
  const access = encrypt(tokens.access_token, c.encryptionKey);
  const refresh = tokens.refresh_token ? encrypt(tokens.refresh_token, c.encryptionKey) : null;
  await supabase("google_connections?on_conflict=user_id", token, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: row.user_id, access_token_ciphertext: access.ciphertext, access_token_iv: access.iv, access_token_tag: access.tag, refresh_token_ciphertext: refresh?.ciphertext, refresh_token_iv: refresh?.iv, refresh_token_tag: refresh?.tag, token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), scopes: tokens.scope.split(" "), requires_reauthorization: false, updated_at: new Date().toISOString() }) });
}

export async function googleDriveStatus(token: string) {
  const user = await userFor(token); const row = await connection(user.id, token);
  return { connected: Boolean(row) && !row.requires_reauthorization, requiresReauthorization: Boolean(row?.requires_reauthorization) };
}

export async function listGoogleDriveFiles(token: string, pageToken?: string) {
  const c = config(); const user = await userFor(token); const row = await connection(user.id, token);
  if (!row) throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 409 });
  let accessToken = decrypt({ ciphertext: row.access_token_ciphertext, iv: row.access_token_iv, tag: row.access_token_tag }, c.encryptionKey);
  if (new Date(row.token_expires_at).getTime() < Date.now() + 30_000) {
    if (!row.refresh_token_ciphertext) throw Object.assign(new Error("Please reconnect Google Drive"), { statusCode: 409 });
    const refreshToken = decrypt({ ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv, tag: row.refresh_token_tag }, c.encryptionKey);
    const refreshed = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
    const next = await refreshed.json(); if (!refreshed.ok) throw Object.assign(new Error("Please reconnect Google Drive"), { statusCode: 409 }); accessToken = next.access_token;
  }
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  Object.entries({ pageSize: "1000", orderBy: "modifiedTime desc", fields: "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)", q: "trashed = false" }).forEach(([key, value]) => url.searchParams.set(key, value));
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw Object.assign(new Error("Could not read Google Drive"), { statusCode: 502 });
  return response.json();
}

export function bearer(request: Request) { return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null; }
export function apiError(error: unknown) { const value = error as { statusCode?: number }; return Response.json({ error: value.statusCode === 401 ? "Authentication is required" : value.statusCode === 503 ? "Google Drive is not configured" : "Could not connect Google Drive" }, { status: value.statusCode ?? 500 }); }

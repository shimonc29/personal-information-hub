import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
export const GOOGLE_CALLBACK = 'http://127.0.0.1:4173/api/connections/google/callback'

export function loadGoogleDriveConfig(env = process.env) {
  const rawKey = env.GOOGLE_TOKEN_ENCRYPTION_KEY
  let encryptionKey
  try { encryptionKey = Buffer.from(rawKey ?? '', 'base64') } catch {}
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || encryptionKey?.length !== 32 || !env.SUPABASE_URL || !(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)) {
    throw new Error('Google Drive is not configured')
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI || GOOGLE_CALLBACK,
    encryptionKey,
    supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ''),
    supabaseKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY,
  }
}

export function createGoogleConnectionRepository({ config, fetchImpl = fetch }) {
  async function request(path, token, options = {}) {
    const response = await fetchImpl(`${config.supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: { apikey: config.supabaseKey, Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers },
    })
    if (!response.ok) throw new Error(`Connection storage failed (${response.status})`)
    if (response.status === 204) return null
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
  return {
    async get(userId, token) { return (await request(`google_connections?user_id=eq.${encodeURIComponent(userId)}&select=*`, token))[0] ?? null },
    async upsert(value, token) {
      const body = {
        user_id: value.userId, access_token_ciphertext: value.accessToken.ciphertext, access_token_iv: value.accessToken.iv, access_token_tag: value.accessToken.tag,
        refresh_token_ciphertext: value.refreshToken?.ciphertext ?? null, refresh_token_iv: value.refreshToken?.iv ?? null, refresh_token_tag: value.refreshToken?.tag ?? null,
        token_expires_at: value.expiresAt, scopes: value.scopes, requires_reauthorization: false, updated_at: new Date().toISOString(),
      }
      return request('google_connections?on_conflict=user_id', token, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) })
    },
    async markRequiresReauthorization(userId, token) { return request(`google_connections?user_id=eq.${encodeURIComponent(userId)}`, token, { method: 'PATCH', body: JSON.stringify({ requires_reauthorization: true, updated_at: new Date().toISOString() }) }) },
    async remove(userId, token) { return request(`google_connections?user_id=eq.${encodeURIComponent(userId)}`, token, { method: 'DELETE' }) },
    async saveState(value, token) {
      await request(`google_oauth_states?user_id=eq.${encodeURIComponent(value.userId)}`, token, { method: 'DELETE' })
      return request('google_oauth_states', token, { method: 'POST', body: JSON.stringify({
        user_id: value.userId, state_hash: value.stateHash,
        session_token_ciphertext: value.sessionToken.ciphertext, session_token_iv: value.sessionToken.iv, session_token_tag: value.sessionToken.tag,
        code_verifier: value.codeVerifier, expires_at: new Date(value.expiresAt).toISOString(),
      }) })
    },
    async consumeState(stateHash) {
      const response = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/consume_google_oauth_state`, {
        method: 'POST',
        headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_state_hash: stateHash }),
      })
      if (!response.ok) throw new Error(`OAuth state storage failed (${response.status})`)
      const row = (await response.json())[0]
      return row ? { userId: row.user_id, sessionToken: { ciphertext: row.session_token_ciphertext, iv: row.session_token_iv, tag: row.session_token_tag }, codeVerifier: row.code_verifier, expiresAt: new Date(row.expires_at).getTime(), stateHash } : null
    },
  }
}

export function createGoogleDriveService({ config, repository, fetchImpl = fetch, now = Date.now }) {
  const states = new Map()
  const encryptToken = (plaintext) => {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', config.encryptionKey, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
  }
  const decryptToken = ({ ciphertext, iv, tag }) => {
    const decipher = createDecipheriv('aes-256-gcm', config.encryptionKey, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')
  }
  async function validateSession(token) {
    const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, { headers: { apikey: config.supabaseKey, Authorization: `Bearer ${token}` } })
    if (!response.ok) throw Object.assign(new Error('Authentication is required'), { statusCode: 401 })
    const user = await response.json()
    if (!user.id) throw Object.assign(new Error('Authentication is required'), { statusCode: 401 })
    return user
  }
  function consumeState(state) {
    if (repository?.consumeState) {
      const stateHash = createHash('sha256').update(state || '').digest('hex')
      return repository.consumeState(stateHash).then((value) => {
        if (!value || value.expiresAt < now()) throw Object.assign(new Error('Invalid or expired OAuth state'), { statusCode: 400 })
        return { userId: value.userId, sessionToken: decryptToken(value.sessionToken), codeVerifier: value.codeVerifier }
      })
    }
    const value = states.get(state); states.delete(state)
    if (!value || value.expiresAt < now()) throw Object.assign(new Error('Invalid or expired OAuth state'), { statusCode: 400 })
    return { userId: value.userId, sessionToken: decryptToken(value.sessionToken), codeVerifier: value.codeVerifier }
  }
  async function start(sessionToken, { forceConsent = true } = {}) {
    const user = await validateSession(sessionToken)
    for (const [key, value] of states) if (value.expiresAt < now() || value.userId === user.id) states.delete(key)
    const state = randomBytes(32).toString('base64url')
    const codeVerifier = randomBytes(48).toString('base64url')
    const storedState = { userId: user.id, stateHash: createHash('sha256').update(state).digest('hex'), sessionToken: encryptToken(sessionToken), codeVerifier, expiresAt: now() + 5 * 60 * 1000 }
    if (repository?.saveState) await repository.saveState(storedState, sessionToken)
    else states.set(state, storedState)
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    const params = { client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: DRIVE_SCOPE, access_type: 'offline', include_granted_scopes: 'true', state }
    if (forceConsent) params.prompt = 'consent'
    params.code_challenge_method = 'S256'
    params.code_challenge = createHash('sha256').update(codeVerifier).digest('base64url')
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    return { url: url.toString() }
  }
  async function callback({ state, code }) {
    if (!code) throw Object.assign(new Error('Authorization code is required'), { statusCode: 400 })
    const identity = await consumeState(state)
    const body = new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: identity.codeVerifier })
    const response = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() })
    if (!response.ok) throw Object.assign(new Error('Google token exchange failed'), { statusCode: 502 })
    const tokens = await response.json()
    validateTokens(tokens)
    const existing = tokens.refresh_token ? null : await repository.get?.(identity.userId, identity.sessionToken)
    const preserved = existing?.refresh_token_ciphertext ? { ciphertext: existing.refresh_token_ciphertext, iv: existing.refresh_token_iv, tag: existing.refresh_token_tag } : null
    await repository.upsert({ userId: identity.userId, accessToken: encryptToken(tokens.access_token), refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : preserved, expiresAt: new Date(now() + tokens.expires_in * 1000).toISOString(), scopes: tokens.scope.split(' ') }, identity.sessionToken)
    return identity
  }
  function validateTokens(tokens) {
    if (!tokens?.access_token || tokens.token_type !== 'Bearer' || !Number.isFinite(tokens.expires_in) || !tokens.scope?.split(' ').includes(DRIVE_SCOPE)) throw Object.assign(new Error('Invalid Google token response'), { statusCode: 502 })
  }
  async function usableAccess(row, userId, sessionToken, forceRefresh = false) {
    if (!forceRefresh && (!row.token_expires_at || new Date(row.token_expires_at).getTime() > now() + 30_000)) return decryptToken({ ciphertext: row.access_token_ciphertext, iv: row.access_token_iv, tag: row.access_token_tag })
    if (!row.refresh_token_ciphertext) throw new Error('Please reconnect Google Drive')
    const refreshToken = decryptToken({ ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv, tag: row.refresh_token_tag })
    const response = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString() })
    const tokens = await response.json()
    if (!response.ok && tokens.error === 'invalid_grant') { await repository.markRequiresReauthorization?.(userId, sessionToken); throw new Error('Please reconnect Google Drive') }
    if (!response.ok) throw new Error('Google token refresh failed')
    validateTokens(tokens)
    await repository.upsert({ userId, accessToken: encryptToken(tokens.access_token), refreshToken: encryptToken(refreshToken), expiresAt: new Date(now() + tokens.expires_in * 1000).toISOString(), scopes: tokens.scope.split(' ') }, sessionToken)
    return tokens.access_token
  }
  return { start, callback, cancel: (state) => consumeState(state), consumeState, encryptToken, decryptToken, validateSession,
    async status(sessionToken) { const user = await validateSession(sessionToken); const row = await repository.get(user.id, sessionToken); return { connected: Boolean(row) && !row.requires_reauthorization, requiresReauthorization: Boolean(row?.requires_reauthorization) } },
    async disconnect(sessionToken) { const user = await validateSession(sessionToken); const row = await repository.get(user.id, sessionToken); try { if (row?.refresh_token_ciphertext) { const token = decryptToken({ ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv, tag: row.refresh_token_tag }); await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(5000) }) } } finally { await repository.remove(user.id, sessionToken) } },
    async listFiles(sessionToken, pageToken) {
      const user = await validateSession(sessionToken); const row = await repository.get(user.id, sessionToken)
      if (!row) throw Object.assign(new Error('Google Drive is not connected'), { statusCode: 409 })
      const accessToken = await usableAccess(row, user.id, sessionToken)
      const url = new URL('https://www.googleapis.com/drive/v3/files'); url.searchParams.set('pageSize', '100'); url.searchParams.set('orderBy', 'modifiedTime desc'); url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)'); url.searchParams.set('q', 'trashed = false'); if (pageToken) url.searchParams.set('pageToken', pageToken)
      let response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (response.status === 401) { const refreshed = await usableAccess(row, user.id, sessionToken, true); response = await fetchImpl(url, { headers: { Authorization: `Bearer ${refreshed}` } }) }
      if (!response.ok) throw Object.assign(new Error('Could not read Google Drive'), { statusCode: 502 }); return response.json()
    }
  }
}

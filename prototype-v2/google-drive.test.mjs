import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createGoogleConnectionRepository, createGoogleDriveService, loadGoogleDriveConfig, DRIVE_SCOPE } from './google-drive.mjs'

const config = {
  clientId: 'client-id', clientSecret: 'client-secret',
  redirectUri: 'http://127.0.0.1:4173/api/connections/google/callback',
  encryptionKey: Buffer.alloc(32, 7), supabaseUrl: 'https://example.supabase.co', supabaseKey: 'public-key',
}

test('Google configuration fails closed when any server secret is missing', () => {
  assert.throws(() => loadGoogleDriveConfig({}), /Google Drive is not configured/)
})

test('connection storage accepts a successful empty Supabase response', async () => {
  const repository = createGoogleConnectionRepository({
    config,
    fetchImpl: async () => new Response('', { status: 201 }),
  })
  await assert.doesNotReject(() => repository.upsert({
    userId: 'user-1',
    accessToken: { ciphertext: 'a', iv: 'b', tag: 'c' },
    refreshToken: null,
    expiresAt: new Date(0).toISOString(),
    scopes: [DRIVE_SCOPE],
  }, 'session-token'))
})

test('start validates the Supabase bearer token and creates a secure offline readonly URL', async () => {
  const calls = []
  const service = createGoogleDriveService({ config, fetchImpl: async (url, init = {}) => {
    calls.push({ url, init })
    return { ok: true, json: async () => ({ id: 'user-123' }) }
  } })
  const result = await service.start('supabase-token')
  const url = new URL(result.url)
  assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/user')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer supabase-token')
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.readonly')
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('include_granted_scopes'), 'true')
  assert.equal(url.searchParams.get('prompt'), 'consent')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(url.searchParams.get('code_challenge'))
  assert.ok(url.searchParams.get('state').length >= 43)
})

test('expired access token refreshes, preserves refresh token, and retries Drive once', async () => {
  let row; let driveCalls = 0; const saved = []
  const repository = { get: async () => row, upsert: async (value) => saved.push(value) }
  const service = createGoogleDriveService({ config, now: () => 10_000, repository, fetchImpl: async (url) => {
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u' }) }
    if (url === 'https://oauth2.googleapis.com/token') return { ok: true, json: async () => ({ access_token: 'new-access', expires_in: 3600, token_type: 'Bearer', scope: DRIVE_SCOPE }) }
    driveCalls++; return { ok: true, json: async () => ({ files: [] }) }
  } })
  const access = service.encryptToken('old-access'); const refresh = service.encryptToken('refresh-secret')
  row = { access_token_ciphertext: access.ciphertext, access_token_iv: access.iv, access_token_tag: access.tag, refresh_token_ciphertext: refresh.ciphertext, refresh_token_iv: refresh.iv, refresh_token_tag: refresh.tag, token_expires_at: new Date(0).toISOString() }
  await service.listFiles('session')
  assert.equal(service.decryptToken(saved[0].refreshToken), 'refresh-secret')
  assert.equal(driveCalls, 1)
})

test('invalid_grant marks the connection as requiring reauthorization', async () => {
  let marked = false; let row
  const repository = { get: async () => row, markRequiresReauthorization: async () => { marked = true } }
  const service = createGoogleDriveService({ config, now: () => 10_000, repository, fetchImpl: async (url) => {
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u' }) }
    return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) }
  } })
  const access = service.encryptToken('old'); const refresh = service.encryptToken('refresh')
  row = { access_token_ciphertext: access.ciphertext, access_token_iv: access.iv, access_token_tag: access.tag, refresh_token_ciphertext: refresh.ciphertext, refresh_token_iv: refresh.iv, refresh_token_tag: refresh.tag, token_expires_at: new Date(0).toISOString() }
  await assert.rejects(() => service.listFiles('session'), /reconnect/i)
  assert.equal(marked, true)
})

test('state is one-time, short-lived, and bound to the authenticated user', async () => {
  let now = 1_000
  const service = createGoogleDriveService({ config, now: () => now, fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'user-123' }) }) })
  const { url } = await service.start('token')
  const state = new URL(url).searchParams.get('state')
  const consumed = service.consumeState(state)
  assert.equal(consumed.userId, 'user-123'); assert.equal(consumed.sessionToken, 'token'); assert.ok(consumed.codeVerifier)
  assert.throws(() => service.consumeState(state), /Invalid or expired OAuth state/)
  const second = new URL((await service.start('token')).url).searchParams.get('state')
  now += 10 * 60 * 1000
  assert.throws(() => service.consumeState(second), /Invalid or expired OAuth state/)
})

test('OAuth state survives separate serverless instances through durable storage', async () => {
  let savedState = null
  const stateRepository = {
    saveState: async (value) => { savedState = value },
    consumeState: async (stateHash) => {
      if (!savedState || savedState.stateHash !== stateHash) return null
      const value = savedState; savedState = null; return value
    },
  }
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-123' }) }
    return { ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: DRIVE_SCOPE, token_type: 'Bearer' }) }
  }
  const firstInstance = createGoogleDriveService({ config, repository: { ...stateRepository }, fetchImpl })
  const secondInstance = createGoogleDriveService({ config, repository: { ...stateRepository, upsert: async () => {} }, fetchImpl })
  const state = new URL((await firstInstance.start('session-token')).url).searchParams.get('state')
  const identity = await secondInstance.callback({ state, code: 'authorization-code' })
  assert.equal(identity.userId, 'user-123')
  await assert.rejects(() => secondInstance.callback({ state, code: 'authorization-code' }), /Invalid or expired OAuth state/)
})

test('production migration consumes hashed OAuth states atomically', async () => {
  const sql = await readFile(new URL('./supabase/migrations/007_google_oauth_states.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table if not exists public\.google_oauth_states/i)
  assert.match(sql, /state_hash text.*unique/i)
  assert.match(sql, /create or replace function public\.consume_google_oauth_state/i)
  assert.match(sql, /delete from public\.google_oauth_states[\s\S]*returning/i)
  assert.match(sql, /security definer/i)
  assert.doesNotMatch(sql, /grant select.*google_oauth_states.*anon/i)
})

test('token encryption is authenticated and never returns plaintext', async () => {
  const service = createGoogleDriveService({ config, fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'u' }) }) })
  const encrypted = service.encryptToken('refresh-secret')
  assert.equal(encrypted.ciphertext.includes('refresh-secret'), false)
  assert.equal(service.decryptToken(encrypted), 'refresh-secret')
  assert.throws(() => service.decryptToken({ ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -2) + 'aa' }))
})

test('callback exchanges code server-side and persists encrypted tokens for the state user', async () => {
  const saved = []
  const service = createGoogleDriveService({ config, repository: { upsert: async (v) => saved.push(v) }, fetchImpl: async (url, init = {}) => {
    if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-123' }) }
    assert.equal(url, 'https://oauth2.googleapis.com/token')
    assert.match(init.body, /code=auth-code/)
    return { ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.readonly', token_type: 'Bearer' }) }
  } })
  const state = new URL((await service.start('token')).url).searchParams.get('state')
  await service.callback({ state, code: 'auth-code' })
  assert.equal(saved[0].userId, 'user-123')
  assert.notEqual(saved[0].refreshToken.ciphertext, 'refresh')
  assert.equal(service.decryptToken(saved[0].refreshToken), 'refresh')
})

test('recent files uses limited fields and supports Drive pagination', async () => {
  const urls = []
  let encrypted
  const repository = { get: async () => ({ access_token_ciphertext: encrypted.ciphertext, access_token_iv: encrypted.iv, access_token_tag: encrypted.tag }) }
  const service = createGoogleDriveService({ config, repository, fetchImpl: async (url) => {
    urls.push(url)
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u' }) }
    return { ok: true, json: async () => ({ files: [], nextPageToken: 'next' }) }
  } })
  encrypted = service.encryptToken('access')
  const result = await service.listFiles('session', 'page-2')
  const driveUrl = new URL(urls[1])
  assert.equal(driveUrl.searchParams.get('pageToken'), 'page-2')
  assert.equal(driveUrl.searchParams.get('pageSize'), '100')
  assert.equal(driveUrl.searchParams.get('fields'), 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)')
  assert.equal(result.nextPageToken, 'next')
})

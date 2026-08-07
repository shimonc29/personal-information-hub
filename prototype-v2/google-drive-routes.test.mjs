import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductServer } from './product-server.mjs'

async function withServer(context, googleDrive) {
  const server = createProductServer({ store: null, staticRoot: new URL('.', import.meta.url), publicConfig: { mode: 'production' }, googleDrive })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

test('Google routes require a Supabase bearer session', async (context) => {
  const base = await withServer(context, { status: async () => assert.fail('must not call') })
  const response = await fetch(`${base}/api/connections/google/status`)
  assert.equal(response.status, 401)
})

test('start, status, files, and disconnect delegate server-side', async (context) => {
  const seen = []
  const googleDrive = {
    start: async (token) => (seen.push(['start', token]), { url: 'https://accounts.google.com/oauth' }),
    status: async (token) => (seen.push(['status', token]), { connected: true }),
    listFiles: async (token, page) => (seen.push(['files', token, page]), { files: [] }),
    disconnect: async (token) => seen.push(['disconnect', token]),
  }
  const base = await withServer(context, googleDrive)
  const headers = { Authorization: 'Bearer session-token' }
  assert.equal((await (await fetch(`${base}/api/connections/google/start`, { method: 'POST', headers })).json()).url, 'https://accounts.google.com/oauth')
  assert.equal((await (await fetch(`${base}/api/connections/google/status`, { headers })).json()).connected, true)
  assert.deepEqual((await (await fetch(`${base}/api/drive/files?pageToken=next`, { headers })).json()).files, [])
  assert.equal((await fetch(`${base}/api/connections/google`, { method: 'DELETE', headers })).status, 204)
  assert.deepEqual(seen, [['start', 'session-token'], ['status', 'session-token'], ['files', 'session-token', 'next'], ['disconnect', 'session-token']])
})

test('OAuth callback rejects Google errors and redirects successful exchange', async (context) => {
  const googleDrive = { callback: async (input) => assert.deepEqual(input, { code: 'code', state: 'state' }) }
  const base = await withServer(context, googleDrive)
  const denied = await fetch(`${base}/api/connections/google/callback?error=access_denied`, { redirect: 'manual' })
  assert.equal(denied.status, 302)
  assert.match(denied.headers.get('location'), /connections\.html\?google=error/)
  const success = await fetch(`${base}/api/connections/google/callback?code=code&state=state`, { redirect: 'manual' })
  assert.equal(success.status, 302)
  assert.match(success.headers.get('location'), /onboarding\.html\?google=connected/)
})

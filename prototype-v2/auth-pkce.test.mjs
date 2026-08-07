import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('auth client configures the official SDK for PKCE in persistent localStorage', async () => {
  let created
  const sdk = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    rpc: async () => ({ error: null }),
  }
  const { createAuthClient } = await import('./auth-client.mjs')
  const storage = memoryStorage()
  createAuthClient({
    url: 'https://project.supabase.co', anonKey: 'public', storage,
    createClientImpl: (url, key, options) => { created = { url, key, options }; return sdk },
  })
  assert.equal(created.url, 'https://project.supabase.co')
  assert.equal(created.key, 'public')
  assert.deepEqual(created.options.auth, {
    flowType: 'pkce', persistSession: true, storage: created.options.auth.storage, detectSessionInUrl: true,
  })
  assert.equal(created.options.auth.storage, storage)
})

test('production entrypoints supply browser localStorage to the PKCE client', async () => {
  const [login, context] = await Promise.all([
    readFile(new URL('./login-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./product-context.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(login, /storage: localStorage/)
  assert.match(context, /storage: localStorage/)
  assert.doesNotMatch(`${login}\n${context}`, /storage: sessionStorage/)
})

test('magic-link login uses the exact login callback URL and logout uses Supabase Auth', async () => {
  const calls = []
  const sdk = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOtp: async (input) => { calls.push(['otp', input]); return { error: null } },
      signOut: async () => { calls.push(['out']); return { error: null } },
    },
    rpc: async () => ({ error: null }),
  }
  const { createAuthClient } = await import('./auth-client.mjs')
  const auth = createAuthClient({ url: 'https://project.supabase.co', anonKey: 'public', storage: memoryStorage(), createClientImpl: () => sdk })
  await auth.sendMagicLink('person@example.com', 'http://127.0.0.1:4173/login.html')
  await auth.signOut()
  assert.deepEqual(calls, [
    ['otp', { email: 'person@example.com', options: { emailRedirectTo: 'http://127.0.0.1:4173/login.html' } }],
    ['out'],
  ])
})

test('initial authenticated session is read, observed, and seeded only once per user', async () => {
  const session = { access_token: 'jwt', user: { id: 'user-1' } }
  let authListener
  let seeds = 0
  const sdk = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: (listener) => { authListener = listener; return { data: { subscription: { unsubscribe() {} } } } },
    },
    rpc: async (name) => { assert.equal(name, 'seed_my_sample_projects'); seeds += 1; return { error: null } },
  }
  const { createAuthClient } = await import('./auth-client.mjs')
  const auth = createAuthClient({ url: 'https://project.supabase.co', anonKey: 'public', storage: memoryStorage(), createClientImpl: () => sdk })
  const initialized = await auth.initialize()
  assert.equal(initialized.access_token, 'jwt')
  assert.equal(await auth.getAccessToken(), 'jwt')
  await auth.ensureSeeded(session)
  authListener('SIGNED_IN', session)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(seeds, 1)
})

test('browser pages load a local SDK bundle and server sends a restrictive local CSP', async () => {
  const [login, context, server] = await Promise.all([
    readFile(new URL('./login.html', import.meta.url), 'utf8'),
    readFile(new URL('./product-context.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./product-server.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(login, /\.\/vendor\/supabase\.js/)
  assert.doesNotMatch(login, /cdn\.jsdelivr|unpkg|esm\.sh/)
  assert.match(context, /\.\/vendor\/supabase\.js/)
  assert.match(server, /content-security-policy/i)
  assert.doesNotMatch(server, /https:\/\/\*\.supabase\.co/)
})

test('seed migrations never overwrite user-edited projects', async () => {
  const [foundation, replacement] = await Promise.all([
    readFile(new URL('./supabase/migrations/001_product_foundation.sql', import.meta.url), 'utf8'),
    readFile(new URL('./supabase/migrations/002_non_destructive_seed.sql', import.meta.url), 'utf8'),
  ])
  for (const sql of [foundation, replacement]) {
    assert.match(sql, /on conflict \(user_id, slug\) do nothing/i)
    assert.doesNotMatch(sql, /do update set/i)
  }
})

test('project detail runs its imports as a module and auth failures expose retry UI', async () => {
  const [project, guard, login] = await Promise.all([
    readFile(new URL('./project-akim.html', import.meta.url), 'utf8'),
    readFile(new URL('./session-guard.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./login-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(project, /<script type="module" src="\.\/project-akim-app\.js"><\/script>/)
  assert.match(guard, /retry|נסה שוב/i)
  assert.match(login, /retry|נסה שוב/i)
})

test('server security headers bind connections to the configured Supabase project', async (context) => {
  const { createProductServer } = await import('./product-server.mjs')
  const server = createProductServer({ store: null, staticRoot: new URL('.', import.meta.url), publicConfig: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public' } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/login.html`)
  const csp = response.headers.get('content-security-policy')
  assert.match(csp, /connect-src 'self' https:\/\/project\.supabase\.co wss:\/\/project\.supabase\.co/)
  assert.match(csp, /object-src 'none'/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.ok(response.headers.get('permissions-policy'))
})

test('vendored Supabase SDK is reproducible and documented as enabled', async () => {
  const [script, setup, deployment] = await Promise.all([
    readFile(new URL('./scripts/sync-supabase-vendor.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./SUPABASE_SETUP.md', import.meta.url), 'utf8'),
    readFile(new URL('./DEPLOYMENT.md', import.meta.url), 'utf8'),
  ])
  assert.match(script, /createHash\(['"]sha256['"]\)/)
  assert.doesNotMatch(`${setup}\n${deployment}`, /SDK[^\n]*(?:blocked|חסומ|לא היתה זמינה)/i)
})

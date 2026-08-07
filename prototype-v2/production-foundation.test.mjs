import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('production config fails closed when Supabase public settings are missing', async () => {
  const { loadProductConfig } = await import('./product-config.mjs')
  assert.throws(() => loadProductConfig({}), /PRODUCT_MODE/)
  assert.throws(() => loadProductConfig({ PRODUCT_MODE: 'production' }), /SUPABASE_URL.*SUPABASE_PUBLISHABLE_KEY/)
})

test('production config accepts the current Supabase publishable-key variable', async () => {
  const { loadProductConfig } = await import('./product-config.mjs')
  const config = loadProductConfig({
    PRODUCT_MODE: 'production',
    SUPABASE_URL: 'https://project.supabase.co/',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public',
  })
  assert.deepEqual(config, {
    mode: 'production',
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'sb_publishable_public',
  })
})

test('sample seed is multi-user safe and callable only by authenticated users', async () => {
  const sql = await readFile(new URL('./supabase/migrations/001_product_foundation.sql', import.meta.url), 'utf8')
  assert.doesNotMatch(sql, /'11111111-1111-4111-8111-111111111111'/)
  assert.match(sql, /on conflict \(user_id, slug\)/i)
  assert.match(sql, /revoke execute on function public\.seed_my_sample_projects\(\) from public, anon/i)
  assert.match(sql, /grant execute on function public\.seed_my_sample_projects\(\) to authenticated/i)
})

test('auth requires explicit session storage and contains no implicit hash callback parser', async () => {
  const source = await readFile(new URL('./auth-client.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /globalThis\.localStorage|location\?\.hash|URLSearchParams\(hash/)
  const { createAuthClient } = await import('./auth-client.mjs')
  assert.throws(() => createAuthClient({ url: 'https://x.supabase.co', anonKey: 'public' }), /storage/)
})

test('local repository is available only in explicit development mode', async () => {
  const { createRepository } = await import('./repository.mjs')
  assert.throws(() => createRepository({ mode: 'production' }), /Supabase/)
  assert.equal(createRepository({ mode: 'development', localStore: { listTasks() {} } }).kind, 'development-local')
})

test('Supabase repository sends the user JWT and never accepts user_id from task input', async () => {
  const calls = []
  const { createSupabaseRepository } = await import('./supabase-repository.mjs')
  const repository = createSupabaseRepository({
    url: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
    getAccessToken: () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify([{ id: 'task-1' }]), { status: 201, headers: { 'content-type': 'application/json' } })
    },
  })

  await repository.createTask({ title: 'Follow up', projectId: 'project-1', user_id: 'attacker-id' })
  const insert = calls.find((call) => call.options.method === 'POST')
  assert.equal(insert.options.headers.Authorization, 'Bearer user-jwt')
  assert.equal(insert.options.headers.apikey, 'public-anon-key')
  assert.equal(JSON.parse(insert.options.body).user_id, undefined)
})

test('Supabase repository rejects invalid tasks before any network request', async () => {
  let requests = 0
  const { createSupabaseRepository } = await import('./supabase-repository.mjs')
  const repository = createSupabaseRepository({ url: 'https://project.supabase.co', anonKey: 'public', getAccessToken: () => 'jwt', fetchImpl: async () => { requests += 1; return new Response('[]') } })
  await assert.rejects(repository.createTask({ projectId: 'akim', title: '   ' }), /title/i)
  await assert.rejects(repository.createTask({ projectId: 'akim', title: 'Task', dueLabel: 'x'.repeat(81) }), /due/i)
  await assert.rejects(repository.createTask({ projectId: 'akim', title: 'Task', priority: 'critical' }), /priority/i)
  assert.equal(requests, 0)
})

test('Supabase repository updates and deletes only the selected task', async () => {
  const calls = []
  const { createSupabaseRepository } = await import('./supabase-repository.mjs')
  const repository = createSupabaseRepository({
    url: 'https://project.supabase.co', anonKey: 'public', getAccessToken: () => 'jwt',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (options.method === 'PATCH') return new Response(JSON.stringify([{ id: 'task-1', title: 'Updated', priority: 'high', due_at: '2026-08-12T12:00:00Z' }]), { status: 200 })
      return new Response(null, { status: 204 })
    },
  })
  const updated = await repository.updateTask('task-1', { title: 'Updated', priority: 'high', dueAt: '2026-08-12T12:00:00Z' })
  await repository.deleteTask('task-1')
  assert.equal(updated.dueAt, '2026-08-12T12:00:00Z')
  assert.match(calls[0].url, /tasks\?id=eq\.task-1$/)
  assert.equal(calls[0].options.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[0].options.body), { title: 'Updated', priority: 'high', due_at: '2026-08-12T12:00:00Z' })
  assert.equal(calls[1].options.method, 'DELETE')
})

test('Supabase repository persists a real due date when creating a task', async () => {
  const calls = []
  const { createSupabaseRepository } = await import('./supabase-repository.mjs')
  const repository = createSupabaseRepository({
    url: 'https://project.supabase.co', anonKey: 'public', getAccessToken: () => 'jwt',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('projects?')) return new Response(JSON.stringify([{ id: 'project-db-id' }]), { status: 200 })
      return new Response(JSON.stringify([{ id: 'task-1', project_id: 'project-db-id', title: 'Plan', due_at: '2026-08-12T12:00:00' }]), { status: 201 })
    },
  })
  await repository.createTask({ projectId: 'heritage-184', title: 'Plan', dueAt: '2026-08-12T12:00:00' })
  const insert = calls.find((call) => call.options.method === 'POST')
  assert.equal(JSON.parse(insert.options.body).due_at, '2026-08-12T12:00:00')
})

test('Supabase repository creates and updates owned projects without accepting user_id', async () => {
  const calls = []
  const { createSupabaseRepository } = await import('./supabase-repository.mjs')
  const repository = createSupabaseRepository({
    url: 'https://project.supabase.co', anonKey: 'public', getAccessToken: () => 'jwt',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      return new Response(JSON.stringify([{ id: 'db-1', slug: 'new-project-x', name: 'New project', client: '', description: '', status: options.method === 'PATCH' ? 'archived' : 'active', status_label: '', documents_count: 0, people_count: 0, tasks_count: 0, next_action: '', updated_label: '', tone: 'blue' }]), { status: 200 })
    },
  })
  await repository.createProject({ slug: 'new-project-x', name: 'New project', status: 'active', user_id: 'attacker' })
  await repository.updateProject('db-1', { status: 'archived' })
  const createBody = JSON.parse(calls[0].options.body)
  assert.equal(createBody.user_id, undefined)
  assert.equal(createBody.name, 'New project')
  assert.match(calls[1].url, /projects\?id=eq\.db-1$/)
  assert.deepEqual(JSON.parse(calls[1].options.body), { status: 'archived', status_label: 'בארכיון' })
})

test('production auth leaves URL callback handling to the official PKCE SDK', async () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  const { createAuthClient } = await import('./auth-client.mjs')
  const auth = createAuthClient({
    storage,
    createClientImpl: () => ({
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    }),
  })
  assert.equal(await auth.getAccessToken(), null)
  assert.equal(auth.captureSession, undefined)
  assert.equal(typeof auth.sendMagicLink, 'function')
})

test('browser repository selector maps Supabase rows to the complete UI contract', async () => {
  const { createBrowserRepository } = await import('./browser-repository.mjs')
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300, aud: 'authenticated' })).toString('base64url')
  const token = `h.${payload}.s`
  const repository = createBrowserRepository({
    config: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public' }, getAccessToken: () => token,
    fetchImpl: async (url, options = {}) => {
      if (url.includes('/rest/v1/projects')) return new Response(JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', slug: 'akim', name: 'Akim', client: 'Client', status: 'waiting', status_label: 'Waiting', documents_count: 8, people_count: 3, tasks_count: 2, next_action: 'Follow up', updated_label: 'Today', tone: 'violet' }]), { status: 200 })
      if (url.includes('/rest/v1/tasks') && options.method === 'POST') return new Response(JSON.stringify([{ id: 't', project_id: '11111111-1111-4111-8111-111111111111', title: 'Task', due_label: 'Today', priority: 'high' }]), { status: 201 })
      return new Response('[]', { status: 200 })
    },
  })
  const [project] = await repository.listProjects()
  assert.deepEqual(project, { id: 'akim', databaseId: '11111111-1111-4111-8111-111111111111', name: 'Akim', client: 'Client', description: '', status: 'waiting', statusLabel: 'Waiting', documents: 8, people: 3, tasks: 2, next: 'Follow up', updated: 'Today', tone: 'violet' })
  const task = await repository.createTask({ projectId: 'akim', title: 'Task', dueLabel: 'Today', priority: 'גבוהה' })
  assert.equal(task.priority, 'גבוהה')
})

test('production API routes fail safely instead of dereferencing a missing local store', async (context) => {
  const { createProductServer } = await import('./product-server.mjs')
  const server = createProductServer({ store: null, staticRoot: new URL('.', import.meta.url), publicConfig: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'public' } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects`)
  assert.equal(response.status, 503)
})

test('migration enables ownership RLS for profiles, projects, and tasks', async () => {
  const sql = await readFile(new URL('./supabase/migrations/001_product_foundation.sql', import.meta.url), 'utf8')
  for (const table of ['profiles', 'projects', 'tasks']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    assert.match(sql, new RegExp(`on public\\.${table}[\\s\\S]+auth\\.uid\\(\\)[\\s\\S]+user_id`, 'i'))
  }
})

test('login page has an email magic-link form and protected pages install a session guard', async () => {
  const [login, guard, index, projectsApp, tasksApp, projectApp] = await Promise.all([
    readFile(new URL('./login.html', import.meta.url), 'utf8'),
    readFile(new URL('./session-guard.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./projects-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./tasks-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./project-akim-app.js', import.meta.url), 'utf8'),
  ])
  assert.match(login, /type="email"/)
  assert.match(login, /login-app\.mjs/)
  assert.match(guard, /login\.html/)
  for (const entrypoint of [index, projectsApp, tasksApp, projectApp]) assert.match(entrypoint, /session-guard\.mjs/)
})

test('server exposes only public runtime configuration', async (context) => {
  const { createProductServer } = await import('./product-server.mjs')
  const server = createProductServer({
    store: {}, staticRoot: new URL('.', import.meta.url),
    publicConfig: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public-key', serviceRoleKey: 'secret' },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`)
  const config = await response.json()
  assert.deepEqual(config, { supabaseUrl: `http://127.0.0.1:${server.address().port}/supabase`, supabaseAnonKey: 'public-key' })
  const forwardedResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/config`, { headers: { 'x-forwarded-proto': 'https' } })
  const forwardedConfig = await forwardedResponse.json()
  assert.deepEqual(forwardedConfig, { supabaseUrl: `https://127.0.0.1:${server.address().port}/supabase`, supabaseAnonKey: 'public-key' })
})

test('local Supabase proxy forwards only approved API paths without browser cookies', async (context) => {
  const calls = []
  const { createProductServer } = await import('./product-server.mjs')
  const server = createProductServer({
    store: {}, staticRoot: new URL('.', import.meta.url),
    publicConfig: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public-key' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(`${base}/supabase/auth/v1/otp?redirect_to=${encodeURIComponent(`${base}/login.html`)}`, {
    method: 'POST', headers: { apikey: 'public-key', authorization: 'Bearer public-key', cookie: 'private=1', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'person@example.com' }),
  })
  assert.equal(response.status, 200)
  assert.equal(calls[0].url, `https://project.supabase.co/auth/v1/otp?redirect_to=${encodeURIComponent(`${base}/login.html`)}`)
  assert.equal(calls[0].options.headers.cookie, undefined)
  assert.equal(calls[0].options.headers.apikey, 'public-key')
  assert.equal(calls[0].options.body.toString(), JSON.stringify({ email: 'person@example.com' }))
  assert.equal((await fetch(`${base}/supabase/storage/v1/object`)).status, 404)
})

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

async function loadProductModule(path, label) {
  try {
    return await import(path)
  } catch {
    assert.fail(`${label} should exist`)
  }
}

test('tasks are saved durably and can be read by a new store instance', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-hub-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const { createDataStore } = await loadProductModule('./data-store.mjs', 'data store')
  const databasePath = join(directory, 'data.json')

  const firstStore = createDataStore(databasePath)
  const task = await firstStore.createTask({
    projectId: 'akim',
    title: 'לחזור לאקים בנוגע להצעת המחיר',
    dueLabel: 'היום',
    priority: 'גבוהה',
  })

  const secondStore = createDataStore(databasePath)
  const tasks = await secondStore.listTasks()
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].id, task.id)
  assert.equal(tasks[0].projectId, 'akim')
})

test('API lists projects and creates a task that remains available', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-hub-api-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const { createDataStore } = await loadProductModule('./data-store.mjs', 'data store')
  const { createProductServer } = await loadProductModule('./product-server.mjs', 'product server')
  const server = createProductServer({
    store: createDataStore(join(directory, 'data.json')),
    staticRoot: new URL('.', import.meta.url),
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const projectsResponse = await fetch(`${baseUrl}/api/projects`)
  const projects = await projectsResponse.json()
  assert.equal(projectsResponse.status, 200)
  assert.equal(projects.length, 6)
  assert.equal(projects[0].id, 'akim')

  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'akim', title: 'משימת מעקב', dueLabel: 'היום', priority: 'גבוהה' }),
  })
  assert.equal(createResponse.status, 201)

  const tasksResponse = await fetch(`${baseUrl}/api/tasks`)
  const tasks = await tasksResponse.json()
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].title, 'משימת מעקב')
})

test('product UI loads projects and creates tasks through the API', async () => {
  const [dashboardApp, projectsApp, tasksApp, tasksHtml] = await Promise.all([
    readFile(new URL('./app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./projects-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./tasks-app.mjs', import.meta.url), 'utf8').catch(() => ''),
    readFile(new URL('./tasks.html', import.meta.url), 'utf8').catch(() => ''),
  ])

  assert.match(dashboardApp, /repository\.createTask/) 
  assert.match(projectsApp, /repository\.listProjects/) 
  assert.match(tasksApp, /repository\.listTasks/) 
  assert.match(tasksHtml, /data-tasks-list/) 
})

test('task API rejects unsafe or invalid input', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-hub-validation-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const { createDataStore } = await import('./data-store.mjs')
  const { createProductServer } = await import('./product-server.mjs')
  const server = createProductServer({ store: createDataStore(join(directory, 'data.json')), staticRoot: new URL('.', import.meta.url) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/api/tasks`

  const wrongType = await fetch(url, { method: 'POST', body: '{}' })
  assert.equal(wrongType.status, 415)
  for (const body of [
    { projectId: 'missing', title: 'task' },
    { projectId: 'akim', title: 'x'.repeat(201) },
    { projectId: 'akim', title: 'task', priority: 'קריטית' },
  ]) {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    assert.equal(response.status, 400)
  }
  const tooLarge = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'akim', title: 'ok', padding: 'x'.repeat(70_000) }) })
  assert.equal(tooLarge.status, 413)
})

test('UI uses safe rendering, real Akim API action, and user-visible recovery states', async () => {
  const [projectsApp, akimApp, akimHtml, tasksApp] = await Promise.all([
    readFile(new URL('./projects-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./project-akim-app.js', import.meta.url), 'utf8'),
    readFile(new URL('./project-akim.html', import.meta.url), 'utf8'),
    readFile(new URL('./tasks-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(projectsApp, /innerHTML/)
  assert.match(projectsApp, /textContent/)
  assert.match(akimApp, /repository\.createTask/) 
  assert.doesNotMatch(akimHtml, /onclick=|createAkimFollowUp/)
  assert.match(`${projectsApp}${akimApp}${tasksApp}`, /retry|נסה שוב/)
})

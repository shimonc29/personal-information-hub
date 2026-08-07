import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildProjectWorkspace, normalizeProjectKey, workspacePanelStates } from './project-workspace-model.mjs'
import { deriveLiveProjectCounts } from './projects-model.mjs'

test('normalizes a stable project query key without accepting arbitrary text', () => {
  assert.equal(normalizeProjectKey('?project=heritage-184'), 'heritage-184')
  assert.equal(normalizeProjectKey('?project=../../secret'), null)
  assert.equal(normalizeProjectKey('?project='), null)
})

test('builds one project workspace from real project, task, workflow, and Drive records', () => {
  const project = { id: 'akim', databaseId: 'project-uuid', name: 'סדנת AI', client: 'אקים', statusLabel: 'פעיל' }
  const result = buildProjectWorkspace({
    projectKey: 'akim',
    projects: [project],
    tasks: [{ id: 't1', projectId: 'project-uuid', title: 'מעקב', completedAt: null }, { id: 'done', projectId: 'project-uuid', title: 'הושלם', completedAt: '2026-08-06T10:00:00Z' }, { id: 't2', projectId: 'other', title: 'לא שייך' }],
    workflows: [
      { driveFileId: 'f1', projectId: 'project-uuid', nextAction: 'לשלוח', handled: false },
      { driveFileId: 'f2', projectId: 'project-uuid', nextAction: '', handled: true },
      { driveFileId: 'f3', projectId: 'other', nextAction: '', handled: false },
    ],
    files: [
      { id: 'f1', name: 'הצעה', webViewLink: 'https://drive.google.com/file/1' },
      { id: 'f2', name: 'סיכום', webViewLink: 'http://unsafe.example/file' },
    ],
  })
  assert.equal(result.project, project)
  assert.deepEqual(result.tasks.map(({ id }) => id), ['t1'])
  assert.deepEqual(result.documents.map(({ id, nextAction, handled, safeUrl }) => ({ id, nextAction, handled, safeUrl })), [
    { id: 'f1', nextAction: 'לשלוח', handled: false, safeUrl: 'https://drive.google.com/file/1' },
    { id: 'f2', nextAction: '', handled: true, safeUrl: null },
  ])
})

test('workspace keeps linked workflow records visible when Drive metadata is unavailable', () => {
  const result = buildProjectWorkspace({
    projectKey: 'akim', projects: [{ id: 'akim', databaseId: 'p1' }], tasks: [], files: [],
    workflows: [{ driveFileId: 'missing', projectId: 'p1', nextAction: 'לבדוק', handled: false }],
  })
  assert.equal(result.documents[0].name, 'מסמך Drive לא זמין')
  assert.equal(result.documents[0].nextAction, 'לבדוק')
})

test('live task and document counts replace persisted counters when datasets load', () => {
  const projects = [{ id: 'akim', databaseId: 'p1', tasks: 99, documents: 88 }, { id: 'other', databaseId: 'p2', tasks: 7, documents: 6 }]
  const live = deriveLiveProjectCounts(projects, { tasks: [{ projectId: 'p1' }, { projectId: 'p1' }], workflows: [{ projectId: 'p1' }], tasksAvailable: true, workflowsAvailable: true })
  assert.deepEqual(live.map(({ tasks, documents }) => ({ tasks, documents })), [{ tasks: 2, documents: 1 }, { tasks: 0, documents: 0 }])
  assert.deepEqual(deriveLiveProjectCounts(projects, { tasksAvailable: false, workflowsAvailable: false })[0], projects[0])
})

test('partial failures have unavailable panels rather than false empty states', () => {
  assert.deepEqual(workspacePanelStates({ project: 'fulfilled', tasks: 'rejected', workflows: 'fulfilled', files: 'rejected' }), { project: 'ready', tasks: 'unavailable', documents: 'metadata-unavailable' })
  assert.deepEqual(workspacePanelStates({ project: 'rejected', tasks: 'fulfilled', workflows: 'fulfilled', files: 'fulfilled' }), { project: 'fatal', tasks: 'unavailable', documents: 'unavailable' })
})

test('repository maps completed_at so completed rows are excluded from live project counts', async () => {
  const { createSupabaseRepository } = await import('./supabase-repository.mjs')
  const repository = createSupabaseRepository({
    url: 'https://project.supabase.co', anonKey: 'public', getAccessToken: () => 'jwt',
    fetchImpl: async () => new Response(JSON.stringify([
      { id: 'open', project_id: 'p1', title: 'Open', due_label: '', priority: 'medium', completed_at: null },
      { id: 'done', project_id: 'p1', title: 'Done', due_label: '', priority: 'medium', completed_at: '2026-08-06T10:00:00Z' },
    ]), { status: 200, headers: { 'content-type': 'application/json' } }),
  })
  const tasks = await repository.listTasks()
  assert.equal(tasks[1].completedAt, '2026-08-06T10:00:00Z')
  const [project] = deriveLiveProjectCounts([{ id: 'akim', databaseId: 'p1', tasks: 9 }], { tasks, tasksAvailable: true })
  assert.equal(project.tasks, 1)
})

test('project cards navigate every project to the shared authenticated workspace', async () => {
  const [projectsApp, projectHtml, projectApp] = await Promise.all([
    readFile(new URL('./projects-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./project.html', import.meta.url), 'utf8'),
    readFile(new URL('./project-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(projectsApp, /project\.html\?project=/)
  assert.match(projectHtml, /data-project-workspace/)
  assert.match(projectHtml, /data-project-task-form/)
  assert.match(projectApp, /sessionReady/)
  assert.match(projectApp, /repository\.createTask/)
  assert.match(projectApp, /form\.hidden = true/)
  assert.doesNotMatch(projectApp, /innerHTML/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { applyWorkflowDrafts, filterDocumentInbox, loadWorkflowContext, mergeDriveWorkflows, safeDriveUrl, workflowFeedbackMessage } from './document-workflow.mjs'
import { createSupabaseRepository } from './supabase-repository.mjs'

const files = [{ id: 'drive-1', name: 'Proposal' }, { id: 'drive-2', name: 'Notes' }]
const workflows = [
  { driveFileId: 'drive-1', projectId: 'project-db-1', nextAction: 'Send for approval', handled: false },
  { driveFileId: 'drive-2', projectId: null, nextAction: '', handled: true },
]

test('merges Drive files with their saved workflow and defaults new files to inbox', () => {
  assert.deepEqual(mergeDriveWorkflows(files, workflows), [
    { ...files[0], workflow: workflows[0] },
    { ...files[1], workflow: workflows[1] },
  ])
  assert.deepEqual(filterDocumentInbox(mergeDriveWorkflows(files, workflows), 'inbox'), [{ ...files[0], workflow: workflows[0] }])
})

test('filters handled documents while all includes every Drive file', () => {
  const merged = mergeDriveWorkflows(files, workflows)
  assert.deepEqual(filterDocumentInbox(merged, 'handled'), [merged[1]])
  assert.deepEqual(filterDocumentInbox(merged, 'all'), merged)
})

test('draft project and next action survive a filter or pagination render', () => {
  const drafts = new Map([['drive-1', { projectId: 'project-db-2', nextAction: 'Unsaved follow-up' }]])
  const merged = mergeDriveWorkflows(files, workflows)
  const rerendered = applyWorkflowDrafts(merged, drafts)
  assert.equal(rerendered[0].workflow.projectId, 'project-db-2')
  assert.equal(rerendered[0].workflow.nextAction, 'Unsaved follow-up')
  assert.equal(rerendered[0].workflow.handled, false)
})

test('only allows HTTPS Drive links to render', () => {
  assert.equal(safeDriveUrl('https://docs.google.com/document/d/1'), 'https://docs.google.com/document/d/1')
  assert.equal(safeDriveUrl('https://drive.google.com/file/d/1'), 'https://drive.google.com/file/d/1')
  assert.equal(safeDriveUrl('https://evil.example/file'), null)
  assert.equal(safeDriveUrl('javascript:alert(1)'), null)
  assert.equal(safeDriveUrl('http://example.test/file'), null)
})

test('missing workflow table degrades to Drive-only mode without blocking projects', async () => {
  const context = await loadWorkflowContext({
    listProjects: async () => [{ id: 'one' }],
    listDocumentWorkflows: async () => { throw new Error('Supabase request failed (404)') },
  })
  assert.deepEqual(context.projects, [{ id: 'one' }])
  assert.deepEqual(context.workflows, [])
  assert.equal(context.projectsAvailable, true)
  assert.equal(context.workflowsAvailable, false)
  assert.equal(context.workflowErrorKind, 'setup')
})

test('project-list failure blocks editing and is not misreported as missing setup', async () => {
  const context = await loadWorkflowContext({
    listProjects: async () => { throw new Error('Network request failed') },
    listDocumentWorkflows: async () => [{ driveFileId: 'drive-1', projectId: 'existing-project' }],
  })
  assert.equal(context.projectsAvailable, false)
  assert.equal(context.workflowsAvailable, true)
  assert.equal(context.editingAvailable, false)
  assert.deepEqual(context.workflows, [{ driveFileId: 'drive-1', projectId: 'existing-project' }])
  assert.equal(context.projectErrorKind, 'transient')
})

test('feedback describes the explicit workflow operation', () => {
  assert.equal(workflowFeedbackMessage('Proposal', 'save'), 'הפעולה עבור „Proposal” נשמרה.')
  assert.equal(workflowFeedbackMessage('Proposal', 'handle'), 'המסמך „Proposal” סומן כטופל.')
  assert.equal(workflowFeedbackMessage('Proposal', 'reopen'), 'המסמך „Proposal” הוחזר לטיפול.')
})

test('Supabase repository performs authenticated same-user document workflow CRUD', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })
    if (options.method === 'DELETE') return { ok: true, status: 204 }
    return { ok: true, status: 200, json: async () => options.method === 'POST' ? [{ drive_file_id: 'drive-1', project_id: 'project-db-1', next_action: 'Call client', handled: false }] : [] }
  }
  const repository = createSupabaseRepository({ url: 'https://example.test', anonKey: 'public-key', getAccessToken: async () => 'user-jwt', fetchImpl })

  await repository.listDocumentWorkflows()
  const saved = await repository.saveDocumentWorkflow({ driveFileId: 'drive-1', projectId: 'project-db-1', nextAction: ' Call client ', handled: false })
  await repository.deleteDocumentWorkflow('drive-1')

  assert.equal(saved.nextAction, 'Call client')
  assert.match(requests[0].url, /document_workflows\?select=/)
  assert.equal(requests[0].options.headers.Authorization, 'Bearer user-jwt')
  assert.match(requests[1].url, /on_conflict=user_id%2Cdrive_file_id/)
  assert.deepEqual(JSON.parse(requests[1].options.body), { drive_file_id: 'drive-1', project_id: 'project-db-1', next_action: 'Call client', handled: false })
  assert.match(requests[2].url, /drive_file_id=eq\.drive-1/)
  await assert.rejects(() => repository.saveDocumentWorkflow({ driveFileId: 'x'.repeat(501), projectId: null, nextAction: '', handled: false }), /Drive file ID/)
})

test('documents UI exposes project, next-action, handled and inbox controls without innerHTML', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./documents.html', import.meta.url), 'utf8'),
    readFile(new URL('./google-drive-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(html, /data-drive-workflow-filter/)
  assert.match(app, /loadWorkflowContext\(repository\)/)
  assert.match(app, /editingAvailable/)
  assert.match(app, /saveDocumentWorkflow/)
  assert.match(app, /data-workflow-project/)
  assert.match(app, /data-workflow-action/)
  assert.match(app, /data-workflow-handled/)
  assert.match(html, /data-workflow-notice/)
  assert.match(html, /aria-live="polite"/)
  assert.match(app, /workflow setup/i)
  assert.doesNotMatch(app, /innerHTML\s*=/)
})

test('numbered migration creates owned document workflows with RLS', async () => {
  const sql = await readFile(new URL('./supabase/migrations/005_document_workflows.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table if not exists public\.document_workflows/i)
  assert.match(sql, /user_id uuid not null.*default auth\.uid\(\)/i)
  assert.match(sql, /unique \(user_id, drive_file_id\)/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /auth\.uid\(\).*user_id/i)
  assert.match(sql, /references public\.projects\(id\)/i)
  assert.match(sql, /project_id is null or exists[\s\S]*projects[\s\S]*projects\.user_id[\s\S]*auth\.uid\(\)/i)
  assert.match(sql, /char_length\(drive_file_id\).*500/i)
})

test('workflow action feedback stays outside cards and action buttons wrap on mobile', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('./documents.html', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(html, /data-workflow-feedback/)
  assert.match(css, /drive-workflow__actions[^}]*flex-wrap:\s*wrap/)
})

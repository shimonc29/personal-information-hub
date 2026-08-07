import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { buildOrganizationPlan, validateInformationArea } from './information-areas.mjs'
import { createSupabaseRepository } from './supabase-repository.mjs'

test('validates a concise personal information area', () => {
  assert.deepEqual(validateInformationArea({ name: 'משפחה', description: 'מסמכים משפחתיים', tone: 'sage', icon: 'בית' }), {
    name: 'משפחה', description: 'מסמכים משפחתיים', tone: 'sage', icon: 'בית',
  })
  assert.throws(() => validateInformationArea({ name: ' ' }), /name/i)
  assert.throws(() => validateInformationArea({ name: 'a'.repeat(81) }), /name/i)
})

test('builds a safe internal organization preview from selected Drive files', () => {
  const plan = buildOrganizationPlan({
    selectedIds: new Set(['drive-2', 'missing', 'drive-1']),
    files: [{ id: 'drive-1', name: 'ביטוח.pdf' }, { id: 'drive-2', name: 'תעודה.docx' }],
    area: { id: 'area-1', name: 'משפחה' },
  })
  assert.equal(plan.areaId, 'area-1')
  assert.equal(plan.areaName, 'משפחה')
  assert.deepEqual(plan.files.map((file) => file.id), ['drive-1', 'drive-2'])
  assert.equal(plan.driveMutation, false)
  assert.throws(() => buildOrganizationPlan({ selectedIds: new Set(), files: [], area: { id: 'a', name: 'A' } }), /file/i)
})

test('repository persists areas and area assignment on document workflows', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })
    const body = options.body ? JSON.parse(options.body) : null
    if (url.includes('information_areas')) return { ok: true, status: 200, json: async () => [{ id: 'area-1', name: body?.name ?? 'משפחה', description: '', tone: 'sage', icon: 'בית', archived_at: null }] }
    return { ok: true, status: 200, json: async () => [{ drive_file_id: 'drive-1', project_id: null, information_area_id: 'area-1', next_action: '', handled: false }] }
  }
  const repository = createSupabaseRepository({ url: 'https://example.test', anonKey: 'key', getAccessToken: async () => 'jwt', fetchImpl })
  const area = await repository.createInformationArea({ name: 'משפחה', description: '', tone: 'sage', icon: 'בית' })
  const workflow = await repository.saveDocumentWorkflow({ driveFileId: 'drive-1', projectId: null, informationAreaId: area.id, nextAction: '', handled: false })
  assert.equal(area.name, 'משפחה')
  assert.equal(workflow.informationAreaId, 'area-1')
  assert.equal(JSON.parse(requests[1].options.body).information_area_id, 'area-1')
})

test('migration owns personal areas and validates area ownership in workflow policies', async () => {
  const sql = await readFile(new URL('./supabase/migrations/006_information_areas.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table if not exists public\.information_areas/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /auth\.uid\(\).*user_id/i)
  assert.match(sql, /information_area_id uuid references public\.information_areas/i)
  assert.match(sql, /information_area_id is null or exists[\s\S]*information_areas\.user_id[\s\S]*auth\.uid\(\)/i)
})

test('areas page and document plan expose explicit preview and no Drive mutation', async () => {
  const [areas, documents, app] = await Promise.all([
    readFile(new URL('./areas.html', import.meta.url), 'utf8'),
    readFile(new URL('./documents.html', import.meta.url), 'utf8'),
    readFile(new URL('./google-drive-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(areas, /data-area-form/)
  assert.match(areas, /data-areas-grid/)
  assert.match(documents, /data-plan-preview/)
  assert.match(documents, /data-plan-confirm/)
  assert.match(app, /buildOrganizationPlan/)
  assert.doesNotMatch(app, /api\/drive\/files[^`'\"]*[`'\"],\s*\{\s*method:\s*['\"](?:PATCH|DELETE|POST)/i)
})

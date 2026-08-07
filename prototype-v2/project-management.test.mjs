import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildProjectSlug, projectStatusLabel, validateProjectDraft } from './project-management.mjs'

test('creates safe stable slugs for Hebrew and Latin project names', () => {
  assert.equal(buildProjectSlug('Family Center', 'abc123'), 'family-center-abc123')
  assert.equal(buildProjectSlug('מרכז חדש', 'abc123'), 'project-abc123')
})

test('validates editable project fields', () => {
  assert.deepEqual(validateProjectDraft({ name: 'פרויקט חדש', client: 'לקוח', status: 'active', nextAction: 'שיחת פתיחה' }), {
    name: 'פרויקט חדש', client: 'לקוח', description: '', status: 'active', nextAction: 'שיחת פתיחה',
  })
  assert.throws(() => validateProjectDraft({ name: ' ', status: 'active' }), /name/i)
  assert.throws(() => validateProjectDraft({ name: 'Valid', status: 'unknown' }), /status/i)
  assert.equal(projectStatusLabel('archived'), 'בארכיון')
})

test('projects page exposes create, edit, status, next action, and archive controls', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./projects.html', import.meta.url), 'utf8'),
    readFile(new URL('./projects-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(html, /data-new-project/)
  assert.match(html, /name="description"/)
  assert.match(html, /name="nextAction"/)
  assert.match(html, /value="archived"/)
  assert.match(app, /repository\.createProject/)
  assert.match(app, /repository\.updateProject/)
})

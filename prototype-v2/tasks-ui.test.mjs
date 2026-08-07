import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('tasks page exposes real date, priority, filters, and edit actions', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./tasks.html', import.meta.url), 'utf8'),
    readFile(new URL('./tasks-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(html, /name="dueDate"[^>]*type="date"/)
  assert.match(html, /name="priority"/)
  for (const filter of ['open', 'today', 'week', 'overdue', 'completed']) assert.match(html, new RegExp(`data-task-filter="${filter}"`))
  assert.match(app, /repository\.updateTask/)
  assert.match(app, /repository\.deleteTask/)
  assert.match(app, /project\.html\?project=/)
})

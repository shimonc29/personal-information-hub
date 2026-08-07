import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyTask, filterTasks, formatTaskDate, toDueAt } from './tasks-model.mjs'

const now = new Date('2026-08-06T10:00:00+03:00')

test('classifies open tasks into today, week, later, and overdue', () => {
  assert.equal(classifyTask({ dueAt: '2026-08-05T12:00:00+03:00' }, now), 'overdue')
  assert.equal(classifyTask({ dueAt: '2026-08-06T18:00:00+03:00' }, now), 'today')
  assert.equal(classifyTask({ dueAt: '2026-08-09T12:00:00+03:00' }, now), 'week')
  assert.equal(classifyTask({ dueAt: '2026-08-18T12:00:00+03:00' }, now), 'later')
  assert.equal(classifyTask({ dueAt: null }, now), 'later')
})

test('completed tasks are separated from open date filters', () => {
  const tasks = [
    { id: 'today', dueAt: '2026-08-06T18:00:00+03:00', completedAt: null },
    { id: 'done', dueAt: '2026-08-05T18:00:00+03:00', completedAt: '2026-08-06T09:00:00+03:00' },
  ]
  assert.deepEqual(filterTasks(tasks, 'today', now).map((task) => task.id), ['today'])
  assert.deepEqual(filterTasks(tasks, 'completed', now).map((task) => task.id), ['done'])
})

test('converts a date input to a stable local midday timestamp', () => {
  assert.equal(toDueAt('2026-08-12'), '2026-08-12T12:00:00')
  assert.equal(toDueAt(''), null)
  assert.equal(formatTaskDate('2026-08-12T12:00:00+03:00', now), '12.8.2026')
  assert.equal(formatTaskDate(null, now), 'ללא תאריך')
})

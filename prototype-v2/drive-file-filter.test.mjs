import test from 'node:test'
import assert from 'node:assert/strict'

import { filterDriveFiles, driveFileKind } from './drive-file-filter.mjs'

const items = [
  { name: 'ניהול לקוחות', mimeType: 'application/vnd.google-apps.spreadsheet' },
  { name: 'סיכום פגישה', mimeType: 'application/vnd.google-apps.document' },
  { name: 'תיקיית פרויקט', mimeType: 'application/vnd.google-apps.folder' },
  { name: 'סרטון תדמית.mp4', mimeType: 'video/mp4' },
]

test('classifies common Drive file types for user-facing filters', () => {
  assert.equal(driveFileKind(items[0]), 'sheets')
  assert.equal(driveFileKind(items[1]), 'docs')
  assert.equal(driveFileKind(items[2]), 'folders')
  assert.equal(driveFileKind(items[3]), 'other')
})

test('filters Drive files by normalized name and kind', () => {
  assert.deepEqual(filterDriveFiles(items, { query: '  פגישה ', kind: 'all' }), [items[1]])
  assert.deepEqual(filterDriveFiles(items, { query: '', kind: 'sheets' }), [items[0]])
  assert.deepEqual(filterDriveFiles(items, { query: 'ניהול', kind: 'docs' }), [])
})

test('filters organization reviews for stale, duplicate, and large files', () => {
  const reviewFiles = [
    { name: 'Report.pdf', mimeType: 'application/pdf', modifiedTime: '2024-01-01T00:00:00Z', size: '60000000' },
    { name: 'report.pdf', mimeType: 'application/pdf', modifiedTime: '2026-08-01T00:00:00Z', size: '10' },
    { name: 'Unique.pdf', mimeType: 'application/pdf', modifiedTime: '2026-08-01T00:00:00Z', size: '10' },
  ]
  const now = new Date('2026-08-06T12:00:00Z')
  assert.deepEqual(filterDriveFiles(reviewFiles, { insight: 'stale', now }), [reviewFiles[0]])
  assert.deepEqual(filterDriveFiles(reviewFiles, { insight: 'large', now }), [reviewFiles[0]])
  assert.deepEqual(filterDriveFiles(reviewFiles, { insight: 'duplicates', now }), reviewFiles.slice(0, 2))
})

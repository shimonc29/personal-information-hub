import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeDriveFiles, classifyDriveFile } from './drive-insights.mjs'

test('classifies Google and uploaded office/media files', () => {
  assert.equal(classifyDriveFile({ mimeType: 'application/vnd.google-apps.document' }), 'documents')
  assert.equal(classifyDriveFile({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'documents')
  assert.equal(classifyDriveFile({ mimeType: 'application/vnd.google-apps.spreadsheet' }), 'sheets')
  assert.equal(classifyDriveFile({ mimeType: 'application/vnd.google-apps.form' }), 'forms')
  assert.equal(classifyDriveFile({ mimeType: 'image/jpeg' }), 'images')
  assert.equal(classifyDriveFile({ mimeType: 'video/mp4' }), 'videos')
  assert.equal(classifyDriveFile({ mimeType: 'application/pdf' }), 'pdf')
})

test('builds safe organization insights from live Drive metadata', () => {
  const files = [
    { id: '1', name: 'Report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', modifiedTime: '2024-01-01T00:00:00Z', size: '70000000' },
    { id: '2', name: 'report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', modifiedTime: '2026-08-01T00:00:00Z', size: '20' },
    { id: '3', name: 'Photo.jpg', mimeType: 'image/jpeg', modifiedTime: '2026-08-02T00:00:00Z', size: '100' },
    { id: '4', name: 'Responses', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-08-02T00:00:00Z' },
  ]
  const result = analyzeDriveFiles(files, new Date('2026-08-06T12:00:00Z'))
  assert.equal(result.total, 4)
  assert.equal(result.counts.documents, 2)
  assert.equal(result.counts.images, 1)
  assert.equal(result.counts.sheets, 1)
  assert.equal(result.stale, 1)
  assert.equal(result.large, 1)
  assert.equal(result.duplicateGroups, 1)
})

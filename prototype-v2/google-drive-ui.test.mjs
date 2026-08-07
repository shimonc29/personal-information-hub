import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('connections and documents pages expose real authenticated Google controls', async () => {
  const [connections, documents, app] = await Promise.all([
    readFile(new URL('./connections.html', import.meta.url), 'utf8'),
    readFile(new URL('./documents.html', import.meta.url), 'utf8'),
    readFile(new URL('./google-drive-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(connections, /data-google-connect/)
  assert.match(connections, /data-google-disconnect/)
  assert.match(documents, /data-drive-files/)
  assert.match(documents, /data-drive-search/)
  assert.match(documents, /data-drive-kind/)
  assert.match(documents, /data-drive-results/)
  assert.match(app, /auth\.getAccessToken/)
  assert.match(app, /\/api\/connections\/google\/start/)
  assert.match(app, /\/api\/drive\/files/)
  assert.match(app, /filterDriveFiles/)
})

test('documents page exposes Drive organization review modes', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./documents.html', import.meta.url), 'utf8'),
    readFile(new URL('./google-drive-app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(html, /data-drive-insight/)
  for (const value of ['stale', 'duplicates', 'large']) assert.match(html, new RegExp(`value="${value}"`))
  assert.match(app, /URLSearchParams\(location\.search\)/)
  assert.match(app, /loadAllInsightPages/)
})

test('all product pages link documents and connections to real pages, not legacy hashes', async () => {
  for (const name of ['index.html', 'projects.html', 'project-akim.html', 'tasks.html', 'connections.html', 'documents.html']) {
    const html = await readFile(new URL(`./${name}`, import.meta.url), 'utf8')
    assert.doesNotMatch(html, /href=["']#(?:documents|connections)["']/)
  }
})

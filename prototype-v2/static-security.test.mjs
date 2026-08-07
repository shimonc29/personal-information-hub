import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductServer } from './product-server.mjs'

test('static server never exposes dotfiles, config, package metadata, migrations, or traversal variants', async (context) => {
  const server = createProductServer({ store: null, staticRoot: new URL('.', import.meta.url), publicConfig: { mode: 'production' } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  for (const path of ['/.env.local', '/%2eenv.local', '/.%65nv.local', '/package-lock.json', '/package.json', '/supabase/migrations/003_google_drive_connections.sql', '/GOOGLE_DRIVE_SETUP.md', '/..%2f.env.local', '/vendor/.hidden.js']) {
    const response = await fetch(base + path)
    assert.ok([403, 404].includes(response.status), `${path} returned ${response.status}`)
    assert.doesNotMatch(await response.text(), /SUPABASE_|GOOGLE_CLIENT_SECRET|sb_publishable_/)
  }
  assert.equal((await fetch(base + '/index.html')).status, 200)
  assert.equal((await fetch(base + '/google-drive-app.mjs')).status, 200)
})

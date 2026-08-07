import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('product server exposes a reusable request handler for serverless hosting', async () => {
  const source = await readFile(new URL('./product-server.mjs', import.meta.url), 'utf8')
  assert.match(source, /export function createProductHandler/)
  assert.match(source, /createServer\(createProductHandler\(/)
})

test('Vercel entrypoint serves the same authenticated product and bundles public assets', async () => {
  const [entrypoint, config] = await Promise.all([
    readFile(new URL('../api/index.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../vercel.json', import.meta.url), 'utf8').then(JSON.parse),
  ])
  assert.match(entrypoint, /createProductHandler/)
  assert.match(entrypoint, /export default/)
  assert.equal(config.builds[0].src, 'api/index.mjs')
  assert.equal(config.builds[0].use, '@vercel/node')
  assert.ok(config.builds[0].config.includeFiles.includes('prototype-v2/**'))
  assert.equal(config.routes[0].dest, '/api/index.mjs')
  assert.equal(config.framework, null)
})

test('deployment documentation includes every production secret and public callback step', async () => {
  const [docs, example] = await Promise.all([
    readFile(new URL('./DEPLOYMENT.md', import.meta.url), 'utf8'),
    readFile(new URL('../.env.product.example', import.meta.url), 'utf8'),
  ])
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_TOKEN_ENCRYPTION_KEY', 'GOOGLE_REDIRECT_URI']) {
    assert.match(docs, new RegExp(name))
    assert.match(example, new RegExp(name))
  }
  assert.match(docs, /Vercel/i)
  assert.match(docs, /GitHub/i)
})

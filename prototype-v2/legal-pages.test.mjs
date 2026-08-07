import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

test('public legal pages explain Google data use, deletion, providers, and service terms', async () => {
  const privacyUrl = new URL('./privacy.html', import.meta.url)
  const termsUrl = new URL('./terms.html', import.meta.url)
  assert.ok(existsSync(privacyUrl), 'privacy policy page is missing')
  assert.ok(existsSync(termsUrl), 'terms page is missing')
  const [privacy, terms] = await Promise.all([readFile(privacyUrl, 'utf8'), readFile(termsUrl, 'utf8')])

  for (const disclosure of ['Google Drive', 'drive.readonly', 'Supabase', 'Vercel', 'מחיקת מידע', 'ניתוק']) {
    assert.match(privacy, new RegExp(disclosure))
  }
  assert.match(privacy, /Google API Services User Data Policy/)
  assert.match(privacy, /Limited Use/)
  assert.match(terms, /תנאי שימוש/)
  assert.match(terms, /קניין רוחני/)
  assert.match(terms, /הגבלת אחריות/)
  assert.match(terms, /שירות.*פיתוח/)
})

test('public entry points link visibly to privacy and terms', async () => {
  const pages = await Promise.all(['login.html', 'onboarding.html', 'connections.html'].map((name) => readFile(new URL(`./${name}`, import.meta.url), 'utf8')))
  for (const page of pages) {
    assert.match(page, /privacy\.html/)
    assert.match(page, /terms\.html/)
  }
})

test('the public login page explains the product and its optional read-only Drive access', async () => {
  const login = await readFile(new URL('./login.html', import.meta.url), 'utf8')
  assert.match(login, /מסמכי Google Drive/)
  assert.match(login, /קריאה בלבד/)
  assert.match(login, /לא משנה או מוחק/)
})

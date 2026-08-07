import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

test('onboarding progress points each user to the first unfinished real step', async () => {
  const moduleUrl = new URL('./onboarding.mjs', import.meta.url)
  assert.ok(existsSync(moduleUrl), 'onboarding progress model is missing')
  const { buildOnboardingProgress } = await import(moduleUrl)

  assert.deepEqual(buildOnboardingProgress({ connected: false, fileCount: 0, areaCount: 0 }), {
    current: 'connect', completed: 0, total: 3, ready: false,
  })
  assert.deepEqual(buildOnboardingProgress({ connected: true, fileCount: 12, areaCount: 0 }), {
    current: 'organize', completed: 2, total: 3, ready: false,
  })
  assert.deepEqual(buildOnboardingProgress({ connected: true, fileCount: 12, areaCount: 2 }), {
    current: 'ready', completed: 3, total: 3, ready: true,
  })
})

test('newly signed-in users enter a complete accessible onboarding journey', async () => {
  const pageUrl = new URL('./onboarding.html', import.meta.url)
  const appUrl = new URL('./onboarding-app.mjs', import.meta.url)
  assert.ok(existsSync(pageUrl), 'onboarding page is missing')
  assert.ok(existsSync(appUrl), 'onboarding browser app is missing')
  const [page, app, login] = await Promise.all([
    readFile(pageUrl, 'utf8'),
    readFile(appUrl, 'utf8'),
    readFile(new URL('./login-app.mjs', import.meta.url), 'utf8'),
  ])
  for (const marker of ['data-onboarding-progress', 'data-onboarding-connect', 'data-onboarding-scan', 'data-onboarding-organize', 'data-onboarding-ready']) {
    assert.match(page, new RegExp(marker))
  }
  assert.match(page, /aria-live="polite"/)
  assert.match(app, /buildOnboardingProgress/)
  assert.match(app, /\/api\/connections\/google\/status/)
  assert.match(app, /\/api\/drive\/files/)
  assert.match(app, /listInformationAreas/)
  assert.match(login, /onboarding\.html/)
})

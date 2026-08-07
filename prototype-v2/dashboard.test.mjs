import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('dashboard model exposes the Akim follow-up workflow', async () => {
  let module

  try {
    module = await import('./dashboard-model.mjs')
  } catch {
    module = null
  }

  assert.ok(module, 'dashboard model should exist')
  const model = module.createDashboardModel()
  const nextModel = module.createFollowUpTask(model, 'akim')

  assert.equal(nextModel.toast, 'משימת המעקב נוצרה')
  assert.equal(nextModel.tasks.at(0)?.title, 'לחזור לאקים בנוגע להצעת המחיר')
  assert.equal(nextModel.attention.unansweredQuotes, 2)
})

test('dashboard markup provides the main Hebrew landmarks and actions', async () => {
  let html = ''

  try {
    html = await readFile(new URL('./index.html', import.meta.url), 'utf8')
  } catch {
    // The first RED run intentionally reaches this branch.
  }

  assert.match(html, /lang="he"/)
  assert.match(html, /dir="rtl"/)
  assert.match(html, /aria-label="ניווט ראשי"/)
  assert.match(html, /ערב טוב, שמעון/)
  assert.match(html, /data-action="create-follow-up"/)
  assert.match(html, /role="status"/)
  assert.match(html, /href="\.\/projects\.html"/)
})

test('dashboard loads its design tokens from the local prototype bundle', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8')
  let tokens = ''

  try {
    tokens = await readFile(new URL('./tokens.css', import.meta.url), 'utf8')
  } catch {
    // The first RED run intentionally reaches this branch.
  }

  assert.match(styles, /@import "\.\/tokens\.css"/)
  assert.match(tokens, /--font-display:/)
  assert.match(tokens, /--color-primary:/)
})

test('dashboard exposes live Drive organization insights and safe review actions', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(html, /data-drive-insights/)
  for (const kind of ['documents', 'sheets', 'forms', 'images', 'pdf']) assert.match(html, new RegExp(`data-drive-count="${kind}"`))
  assert.match(html, /סדר ב־Drive/)
  assert.match(app, /analyzeDriveFiles/)
  assert.match(app, /\/api\/drive\/files/)
  assert.match(app, /files\.push\([\s\S]+renderDriveInsights\(analyzeDriveFiles\(files\)/)
  assert.match(app, /AbortSignal\.timeout/)
  for (const insight of ['stale', 'duplicates', 'large']) assert.match(html, new RegExp(`documents\\.html\\?insight=${insight}`))
  assert.doesNotMatch(app, /method:\s*['"](?:DELETE|PATCH)['"]/)
})

test('dashboard loads and renders the signed-in users information areas', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./app.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(html, /data-dashboard-areas/)
  assert.match(html, /href="\.\/areas\.html"/)
  assert.match(app, /repository\.listInformationAreas\(\)/)
  assert.match(app, /data-dashboard-area-count/)
  assert.match(app, /documents\.html\?area=/)
  assert.doesNotMatch(app, /innerHTML\s*=/)
})

test('projects can be filtered by their product status', async () => {
  let module

  try {
    module = await import('./projects-model.mjs')
  } catch {
    module = null
  }

  assert.ok(module, 'projects model should exist')
  const projects = module.createProjectsModel()

  assert.deepEqual(
    module.filterProjects(projects, 'waiting').map((project) => project.id),
    ['akim', 'garinim'],
  )
  assert.equal(module.filterProjects(projects, 'all').length, 6)
})

test('projects and Akim detail pages link the product journey together', async () => {
  let projectsHtml = ''
  let detailHtml = ''
  let projectsApp = ''

  try {
    ;[projectsHtml, detailHtml, projectsApp] = await Promise.all([
      readFile(new URL('./projects.html', import.meta.url), 'utf8'),
      readFile(new URL('./project-akim.html', import.meta.url), 'utf8'),
      readFile(new URL('./projects-app.mjs', import.meta.url), 'utf8'),
    ])
  } catch {
    // The first RED run intentionally reaches this branch.
  }

  assert.match(projectsHtml, /data-filter="waiting"/)
  assert.match(projectsApp, /project\.html\?project=/)
  assert.match(detailHtml, /סדנת AI לאקים/)
  assert.match(detailHtml, /data-action="create-follow-up"/)
  assert.doesNotMatch(detailHtml, /onclick=|createAkimFollowUp/)
  assert.match(detailHtml, /מקורות המידע/)
})

test('Akim page binds its interactions after the document is ready', async () => {
  const detailHtml = await readFile(new URL('./project-akim.html', import.meta.url), 'utf8')
  let detailApp = ''

  try {
    detailApp = await readFile(new URL('./project-akim-app.js', import.meta.url), 'utf8')
  } catch {
    // The first RED run intentionally reaches this branch.
  }

  assert.match(detailHtml, /src="\.\/project-akim-app\.js"/)
  assert.doesNotMatch(detailApp, /DOMContentLoaded/)
  assert.match(detailApp, /button\.addEventListener\('click'/)
  assert.match(detailApp, /repository\.createTask/)
})

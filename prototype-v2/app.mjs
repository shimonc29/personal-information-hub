import { createDashboardModel, createFollowUpTask } from './dashboard-model.mjs'
import { analyzeDriveFiles } from './drive-insights.mjs'
import { auth, config, repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'

await sessionReady
let model = createDashboardModel()
const toast = document.querySelector('.toast')
const counter = document.querySelector('[data-counter="unansweredQuotes"]')
const actionButton = document.querySelector('[data-action="create-follow-up"]')
function render() { counter.textContent = String(model.attention.unansweredQuotes); toast.textContent = model.toast; toast.classList.toggle('is-visible', Boolean(model.toast)) }
actionButton.addEventListener('click', async () => {
  actionButton.disabled = true
  try {
    await repository.createTask({ projectId: 'akim', title: 'מעקב אחר הצעת המחיר', dueLabel: 'היום', priority: 'גבוהה' })
    model = createFollowUpTask(model, 'akim'); actionButton.textContent = '✓'
  } catch { actionButton.disabled = false; actionButton.textContent = 'נסה שוב'; model = { ...model, toast: 'לא הצלחנו ליצור את המשימה.' } }
  render()
})
document.querySelector('#ask-form').addEventListener('submit', (event) => { event.preventDefault(); model = { ...model, toast: 'השאלה נשלחה לעוזר האישי' }; render() })
document.querySelectorAll('.prompt-chips button').forEach((button) => button.addEventListener('click', () => { document.querySelector('#ask-input').value = button.textContent }))
render()

function dashboardAreaCard(area, documentCount) {
  const card = document.createElement('a')
  card.className = `dashboard-area-card dashboard-area-card--${area.tone}`
  card.href = `./documents.html?area=${encodeURIComponent(area.id)}`
  const icon = document.createElement('span'); icon.className = 'dashboard-area-card__icon'; icon.textContent = area.icon
  const copy = document.createElement('span')
  const title = document.createElement('strong'); title.textContent = area.name
  const description = document.createElement('small'); description.textContent = area.description || 'אזור מידע אישי'
  copy.append(title, description)
  const count = document.createElement('b'); count.textContent = `${documentCount} מסמכים`
  card.append(icon, copy, count)
  return card
}

async function loadDashboardAreas() {
  const grid = document.querySelector('[data-dashboard-areas]')
  const count = document.querySelector('[data-dashboard-area-count]')
  try {
    const [areas, workflows] = await Promise.all([repository.listInformationAreas(), repository.listDocumentWorkflows()])
    count.textContent = String(areas.length)
    grid.replaceChildren(...areas.map((area) => dashboardAreaCard(area, workflows.filter((workflow) => workflow.informationAreaId === area.id).length)))
    if (!areas.length) {
      const empty = document.createElement('a'); empty.className = 'dashboard-areas-empty'; empty.href = './areas.html'; empty.textContent = 'יצירת אזור המידע הראשון שלך ←'
      grid.append(empty)
    }
  } catch {
    count.textContent = '—'
    const retry = document.createElement('a'); retry.className = 'dashboard-areas-empty'; retry.href = './areas.html'; retry.textContent = 'פתיחת אזורי המידע ←'
    grid.replaceChildren(retry)
  }
}

loadDashboardAreas()

function renderDriveInsights(insights, truncated = false) {
  document.querySelector('[data-drive-total]').textContent = truncated ? `${insights.total}+` : String(insights.total)
  document.querySelectorAll('[data-drive-count]').forEach((node) => { node.textContent = String(insights.counts[node.dataset.driveCount] ?? 0) })
  document.querySelector('[data-drive-stale]').textContent = String(insights.stale)
  document.querySelector('[data-drive-duplicates]').textContent = String(insights.duplicateGroups)
  document.querySelector('[data-drive-large]').textContent = String(insights.large)
  document.querySelector('[data-drive-insights-status]').textContent = truncated ? `נסרקו ${insights.total} פריטים… ממשיכים לסרוק.` : `הסריקה הושלמה · ${insights.total} פריטים`
}

async function loadDriveInsights() {
  const status = document.querySelector('[data-drive-insights-status]')
  if (config.mode === 'development') { status.textContent = 'חיבור Drive זמין במצב המוצר המחובר.'; return }
  const files = []
  try {
    const token = await auth.getAccessToken()
    if (!token) throw new Error('authentication')
    let pageToken = null
    let pages = 0
    do {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''
      const response = await fetch(`/api/drive/files${query}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'drive')
      files.push(...(result.files ?? []))
      pageToken = result.nextPageToken || null
      pages += 1
      renderDriveInsights(analyzeDriveFiles(files), Boolean(pageToken))
    } while (pageToken && pages < 50)
    renderDriveInsights(analyzeDriveFiles(files), Boolean(pageToken))
    if (pageToken) status.textContent = `הוצגה תמונת מצב של ${files.length} הקבצים האחרונים.`
  } catch {
    if (files.length) status.textContent = `הוצגה תמונת מצב חלקית של ${files.length} פריטים. אפשר לרענן כדי להשלים.`
    else status.textContent = 'כדי לראות את תמונת המצב, יש לחבר את Google Drive במסך החיבורים.'
  }
}

loadDriveInsights()

import { filterDriveFiles } from './drive-file-filter.mjs'
import { applyWorkflowDrafts, filterDocumentInbox, loadWorkflowContext, mergeDriveWorkflows, safeDriveUrl, workflowFeedbackMessage } from './document-workflow.mjs'
import { buildOrganizationPlan } from './information-areas.mjs'
import { auth, config, repository } from './product-context.mjs'

const status = document.querySelector('[data-google-status]')
const errorBox = document.querySelector('[data-google-error]')
const connect = document.querySelector('[data-google-connect]')
const disconnect = document.querySelector('[data-google-disconnect]')
const documentsLink = document.querySelector('[data-google-documents]')
const files = document.querySelector('[data-drive-files]')
const more = document.querySelector('[data-drive-more]')
const search = document.querySelector('[data-drive-search]')
const kind = document.querySelector('[data-drive-kind]')
const results = document.querySelector('[data-drive-results]')
const workflowFilter = document.querySelector('[data-drive-workflow-filter]')
const insightFilter = document.querySelector('[data-drive-insight]')
const workflowNotice = document.querySelector('[data-workflow-notice]')
const workflowFeedback = document.querySelector('[data-workflow-feedback]')
const planBar = document.querySelector('[data-plan-bar]')
const planCount = document.querySelector('[data-plan-count]')
const planArea = document.querySelector('[data-plan-area]')
const planDialog = document.querySelector('[data-plan-dialog]')
const planSummary = document.querySelector('[data-plan-summary]')
let nextPageToken
let loading = false
const loadedFiles = []
let workflows = []
let projects = []
let areas = []
let workflowsAvailable = true
let editingAvailable = true
const workflowDrafts = new Map()
const selectedFileIds = new Set()
let currentPlan = null
const WORKFLOW_SETUP_NOTICE = 'workflow setup is required'
const requestedInsight = new URLSearchParams(location.search).get('insight')
const requestedArea = new URLSearchParams(location.search).get('area')
if (insightFilter && ['stale', 'duplicates', 'large'].includes(requestedInsight)) {
  insightFilter.value = requestedInsight
  if (workflowFilter) workflowFilter.value = 'all'
}

async function api(path, options = {}) {
  if (config.mode === 'development') throw new Error('Google Drive זמין לאחר הפעלה במצב production')
  const token = await auth.getAccessToken()
  if (!token) { location.replace('./login.html'); throw new Error('נדרשת התחברות') }
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
  const result = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(result?.error || 'הפעולה נכשלה')
  return result
}

function showError(error) { if (errorBox) errorBox.textContent = error.message }

function updatePlanBar() {
  if (!planBar) return
  planBar.hidden = selectedFileIds.size === 0
  planCount.textContent = selectedFileIds.size
}

async function loadStatus() {
  const result = await api('/api/connections/google/status')
  status.textContent = result.connected ? 'Google Drive מחובר בהצלחה.' : 'Google Drive עדיין לא מחובר.'
  if (connect) connect.hidden = result.connected
  if (disconnect) disconnect.hidden = !result.connected
  if (documentsLink) documentsLink.hidden = !result.connected
}

function fileCard(file) {
  const card = document.createElement('article')
  card.className = 'project-card drive-file-card'
  card.classList.toggle('is-handled', file.workflow.handled)
  card.classList.toggle('is-selected', selectedFileIds.has(file.id))
  const selection = document.createElement('label')
  selection.className = 'drive-file-selection'
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = selectedFileIds.has(file.id)
  checkbox.setAttribute('aria-label', `בחירת ${file.name} לתוכנית סדר`)
  checkbox.addEventListener('change', () => {
    checkbox.checked ? selectedFileIds.add(file.id) : selectedFileIds.delete(file.id)
    card.classList.toggle('is-selected', checkbox.checked)
    updatePlanBar()
  })
  selection.append(checkbox, document.createTextNode('בחירה לתוכנית סדר'))
  const title = document.createElement('h2')
  title.textContent = file.name
  const meta = document.createElement('p')
  meta.textContent = file.modifiedTime ? `עודכן: ${new Date(file.modifiedTime).toLocaleString('he-IL')}` : file.mimeType
  card.append(selection, title, meta)
  const workflow = document.createElement('div')
  workflow.className = 'drive-workflow'

  const projectLabel = document.createElement('label')
  projectLabel.append(document.createTextNode('שיוך לפרויקט'))
  const projectSelect = document.createElement('select')
  projectSelect.setAttribute('data-workflow-project', '')
  const noProject = document.createElement('option')
  noProject.value = ''
  noProject.textContent = 'ללא פרויקט'
  projectSelect.append(noProject)
  for (const project of projects) {
    const option = document.createElement('option')
    option.value = project.databaseId
    option.textContent = project.name
    option.selected = project.databaseId === file.workflow.projectId
    projectSelect.append(option)
  }
  if (file.workflow.projectId && !projects.some((project) => project.databaseId === file.workflow.projectId)) {
    const existing = document.createElement('option')
    existing.value = file.workflow.projectId
    existing.textContent = 'שיוך קיים (רשימת הפרויקטים לא נטענה)'
    existing.selected = true
    projectSelect.append(existing)
  }
  projectSelect.disabled = !editingAvailable
  projectLabel.append(projectSelect)

  const actionLabel = document.createElement('label')
  actionLabel.append(document.createTextNode('הפעולה הבאה'))
  const actionInput = document.createElement('input')
  actionInput.setAttribute('data-workflow-action', '')
  actionInput.maxLength = 500
  actionInput.placeholder = 'למשל: לשלוח ללקוח לאישור'
  actionInput.value = file.workflow.nextAction
  actionInput.disabled = !editingAvailable
  actionLabel.append(actionInput)
  const captureDraft = () => workflowDrafts.set(file.id, { projectId: projectSelect.value || null, nextAction: actionInput.value })
  projectSelect.addEventListener('change', captureDraft)
  actionInput.addEventListener('input', captureDraft)

  const actions = document.createElement('div')
  actions.className = 'drive-workflow__actions'
  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = 'שמירת פעולה'
  const handled = document.createElement('button')
  handled.type = 'button'
  handled.setAttribute('data-workflow-handled', '')
  handled.textContent = file.workflow.handled ? 'החזרה לטיפול' : 'סימון כטופל'
  save.disabled = !editingAvailable
  handled.disabled = !editingAvailable
  const saveStatus = document.createElement('span')
  saveStatus.className = 'drive-workflow__status'

  async function persist(operation, nextHandled = file.workflow.handled) {
    if (!editingAvailable) return
    save.disabled = true
    handled.disabled = true
    saveStatus.textContent = 'שומר…'
    try {
      const saved = await repository.saveDocumentWorkflow({
        driveFileId: file.id,
        projectId: projectSelect.value || null,
        informationAreaId: file.workflow.informationAreaId || null,
        nextAction: actionInput.value,
        handled: nextHandled,
      })
      workflows = workflows.filter((item) => item.driveFileId !== file.id)
      workflows.push(saved)
      workflowDrafts.delete(file.id)
      if (workflowFeedback) workflowFeedback.textContent = workflowFeedbackMessage(file.name, operation)
      renderFiles()
    } catch (error) {
      saveStatus.textContent = 'השמירה נכשלה'
      if (workflowFeedback) workflowFeedback.textContent = `השמירה עבור „${file.name}” נכשלה. אפשר לנסות שוב.`
      showError(error)
    } finally {
      save.disabled = false
      handled.disabled = false
    }
  }
  save.addEventListener('click', () => persist('save'))
  handled.addEventListener('click', () => persist(file.workflow.handled ? 'reopen' : 'handle', !file.workflow.handled))
  actions.append(save, handled, saveStatus)
  workflow.append(projectLabel, actionLabel, actions)
  if (workflowsAvailable) card.append(workflow)
  const externalUrl = safeDriveUrl(file.webViewLink)
  if (externalUrl) {
    const link = document.createElement('a')
    link.href = externalUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'פתיחה ב־Google Drive'
    card.append(link)
  }
  return card
}

function renderFiles() {
  if (!files) return
  const actionableFiles = applyWorkflowDrafts(mergeDriveWorkflows(loadedFiles, workflows), workflowDrafts)
  const statusFiltered = filterDocumentInbox(actionableFiles, workflowFilter?.value)
  const visibleFiles = filterDriveFiles(statusFiltered, { query: search?.value, kind: kind?.value, insight: insightFilter?.value })
  files.replaceChildren(...visibleFiles.map(fileCard))
  if (results) results.textContent = visibleFiles.length === 1 ? 'מסמך אחד נמצא' : `${visibleFiles.length} מסמכים נמצאו`
  if (status) {
    if (loadedFiles.length && !visibleFiles.length) status.textContent = 'לא נמצאו מסמכים שמתאימים לחיפוש.'
    else status.textContent = editingAvailable ? '' : 'קבצי Drive מוצגים כעת במצב צפייה בלבד.'
  }
}

async function loadFiles(pageToken) {
  if (loading) return
  loading = true
  if (more) more.disabled = true
  let result
  try {
    result = await api(`/api/drive/files${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`)
  } catch (error) {
    if (/not connected/i.test(error.message)) {
      status.textContent = 'Google Drive עדיין לא מחובר.'
      if (connect) connect.hidden = false
    }
    throw error
  } finally {
    loading = false
    if (more) more.disabled = false
  }
  loadedFiles.push(...result.files)
  renderFiles()
  if (!loadedFiles.length) status.textContent = 'לא נמצאו קבצים.'
  nextPageToken = result.nextPageToken
  more.hidden = !nextPageToken
}

async function loadAllInsightPages() {
  let pages = 0
  while (nextPageToken && pages < 49) {
    const token = nextPageToken
    await loadFiles(token)
    pages += 1
  }
  if (status && loadedFiles.length) status.textContent = nextPageToken ? `הוצגו תוצאות מתוך ${loadedFiles.length} הפריטים האחרונים.` : `הסריקה הושלמה · ${loadedFiles.length} פריטים נבדקו.`
}

connect?.addEventListener('click', async () => { try { const { url } = await api('/api/connections/google/start', { method: 'POST' }); location.assign(url) } catch (error) { showError(error) } })
disconnect?.addEventListener('click', async () => { try { await api('/api/connections/google', { method: 'DELETE' }); await loadStatus() } catch (error) { showError(error) } })
more?.addEventListener('click', () => loadFiles(nextPageToken).catch(showError))
search?.addEventListener('input', renderFiles)
kind?.addEventListener('change', renderFiles)
workflowFilter?.addEventListener('change', renderFiles)
insightFilter?.addEventListener('change', () => { renderFiles(); if (insightFilter.value !== 'all' && nextPageToken) loadAllInsightPages().catch(showError) })

document.querySelector('[data-plan-clear]')?.addEventListener('click', () => {
  selectedFileIds.clear(); currentPlan = null; updatePlanBar(); renderFiles()
})
document.querySelector('[data-plan-preview]')?.addEventListener('click', () => {
  try {
    const area = areas.find((item) => item.id === planArea.value)
    currentPlan = buildOrganizationPlan({ selectedIds: selectedFileIds, files: loadedFiles, area })
    const heading = document.createElement('h3')
    heading.textContent = `שיוך אל “${currentPlan.areaName}”`
    const list = document.createElement('ul')
    list.className = 'plan-file-list'
    for (const file of currentPlan.files) { const item = document.createElement('li'); item.textContent = file.name; list.append(item) }
    planSummary.replaceChildren(heading, list)
    document.querySelector('[data-plan-feedback]').textContent = ''
    planDialog.showModal()
  } catch {
    if (workflowFeedback) workflowFeedback.textContent = 'בחרו אזור מידע ולפחות מסמך אחד כדי להציג את התוכנית.'
  }
})
document.querySelector('[data-plan-close]')?.addEventListener('click', () => planDialog.close())
document.querySelector('[data-plan-cancel]')?.addEventListener('click', () => planDialog.close())
document.querySelector('[data-plan-confirm]')?.addEventListener('click', async (event) => {
  if (!currentPlan) return
  const button = event.currentTarget
  const feedback = document.querySelector('[data-plan-feedback]')
  button.disabled = true; feedback.textContent = 'שומר את השיוך…'
  try {
    const merged = mergeDriveWorkflows(loadedFiles, workflows)
    const saved = await Promise.all(currentPlan.files.map((plannedFile) => {
      const file = merged.find((item) => item.id === plannedFile.id)
      return repository.saveDocumentWorkflow({ driveFileId: file.id, projectId: file.workflow.projectId, informationAreaId: currentPlan.areaId, nextAction: file.workflow.nextAction, handled: file.workflow.handled })
    }))
    const savedIds = new Set(saved.map((item) => item.driveFileId))
    workflows = [...workflows.filter((item) => !savedIds.has(item.driveFileId)), ...saved]
    selectedFileIds.clear(); currentPlan = null; planDialog.close(); updatePlanBar(); renderFiles()
    workflowFeedback.textContent = `${saved.length} מסמכים שויכו לאזור. לא בוצע שינוי ב‑Google Drive.`
  } catch {
    feedback.textContent = 'השמירה נכשלה. לא בוצע שינוי ב‑Google Drive ואפשר לנסות שוב.'
  } finally { button.disabled = false }
})

if (files) loadWorkflowContext(repository)
  .then((context) => {
    projects = context.projects
    workflows = context.workflows
    areas = context.areas
    if (planArea) {
      for (const area of areas) { const option = document.createElement('option'); option.value = area.id; option.textContent = area.name; planArea.append(option) }
      if (requestedArea && areas.some((area) => area.id === requestedArea)) planArea.value = requestedArea
    }
    workflowsAvailable = context.workflowsAvailable
    editingAvailable = context.editingAvailable
    if (!editingAvailable && workflowNotice) {
      workflowNotice.hidden = false
      if (context.workflowErrorKind === 'setup') {
        workflowNotice.textContent = 'אפשר לצפות בקבצי Drive, אך פעולות המסמכים עדיין אינן זמינות. יש להשלים את הגדרת מסד הנתונים.'
        workflowNotice.dataset.reason = WORKFLOW_SETUP_NOTICE
      } else if (context.projectErrorKind === 'authorization' || context.workflowErrorKind === 'authorization') {
        workflowNotice.textContent = 'קבצי Drive זמינים לצפייה, אך אין כרגע הרשאה לטעון את פעולות המסמכים. נסו להתחבר מחדש.'
      } else {
        workflowNotice.textContent = 'קבצי Drive זמינים לצפייה, אך פעולות המסמכים לא נטענו עקב תקלה זמנית. רעננו את העמוד כדי לנסות שוב.'
      }
    }
    return loadFiles().then(() => insightFilter?.value !== 'all' ? loadAllInsightPages() : null)
  })
  .catch(showError)
else loadStatus().catch(showError)

const feedback = new URLSearchParams(location.search).get('google')
if (feedback === 'connected' && status) status.textContent = 'Google Drive חובר בהצלחה.'
if (feedback === 'error' && errorBox) errorBox.textContent = 'החיבור ל־Google Drive לא הושלם. אפשר לנסות שוב.'

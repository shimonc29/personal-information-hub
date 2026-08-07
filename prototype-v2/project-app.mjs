import { auth, config, repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'
import { buildProjectWorkspace, normalizeProjectKey, workspacePanelStates } from './project-workspace-model.mjs'

const header = document.querySelector('[data-project-header]')
const errorBox = document.querySelector('[data-project-error]')
const tasksBox = document.querySelector('[data-project-tasks]')
const documentsBox = document.querySelector('[data-project-documents]')
const taskCount = document.querySelector('[data-project-task-count]')
const documentCount = document.querySelector('[data-project-document-count]')
const form = document.querySelector('[data-project-task-form]')
const feedback = document.querySelector('[data-project-task-feedback]')
const projectKey = normalizeProjectKey(location.search)
let currentProject
let currentTasks = []
let loading = true
let submitting = false
form.hidden = true

function node(tag, className, text) {
  const item = document.createElement(tag)
  if (className) item.className = className
  if (text !== undefined) item.textContent = text
  return item
}

function showError(message) { errorBox.hidden = false; errorBox.textContent = message }
function clearError() { errorBox.hidden = true; errorBox.textContent = '' }

function unavailable(container, message, retry = loadWorkspace) {
  const box = node('div', 'task-empty')
  box.append(node('p', '', message))
  const button = node('button', 'secondary-button', 'ניסיון נוסף')
  button.type = 'button'; button.addEventListener('click', retry); box.append(button)
  container.replaceChildren(box)
}

function renderHeader(project) {
  const icon = node('span', `project-icon project-icon--${project.tone || 'violet'}`, project.name?.charAt(0) || 'פ')
  const copy = node('div', 'workspace-hero__copy')
  const meta = node('div', 'detail-kicker')
  meta.append(node('span', `status-pill status-pill--${project.status || 'active'}`, project.statusLabel || 'פרויקט'), node('span', '', project.updated ? `עודכן ${project.updated}` : ''))
  copy.append(meta, node('h1', '', project.name), node('p', '', project.client || 'פרויקט אישי'))
  header.replaceChildren(icon, copy)
  document.title = `${project.name} · המרכז האישי`
}

function renderTasks(tasks) {
  taskCount.textContent = `${tasks.length} משימות`
  if (!tasks.length) { tasksBox.replaceChildren(node('p', 'task-empty', 'אין עדיין משימות בפרויקט. אפשר ליצור את הראשונה כאן.')); return }
  tasksBox.replaceChildren(...tasks.map((task) => {
    const row = node('article', 'workspace-task-row')
    const marker = node('span', 'workspace-task-marker', '✓')
    const copy = node('div')
    copy.append(node('strong', '', task.title), node('small', '', [task.dueLabel, task.priority].filter(Boolean).join(' · ') || 'ללא מועד'))
    row.append(marker, copy)
    return row
  }))
}

function renderDocuments(documents) {
  documentCount.textContent = `${documents.length} מסמכים`
  if (!documents.length) { documentsBox.replaceChildren(node('p', 'task-empty', 'אין מסמכי Drive משויכים לפרויקט. אפשר לשייך מסמכים מתיבת המסמכים.')); return }
  documentsBox.replaceChildren(...documents.map((document) => {
    const card = node('article', `workspace-document${document.handled ? ' is-handled' : ''}`)
    const icon = node('span', 'workspace-document__icon', document.mimeType?.includes('spreadsheet') ? '▦' : '▤')
    const copy = node('div', 'workspace-document__copy')
    copy.append(node('strong', '', document.name), node('span', 'workspace-document__action', document.nextAction || (document.handled ? 'טופל' : 'לא הוגדרה פעולה הבאה')))
    const state = node('span', `workspace-state ${document.handled ? 'is-done' : ''}`, document.handled ? 'טופל' : 'לטיפול')
    card.append(icon, copy, state)
    if (document.safeUrl) {
      const link = node('a', 'workspace-document__link', 'פתיחה ב־Drive ←')
      link.href = document.safeUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'
      card.append(link)
    }
    return card
  }))
}

async function loadDriveFiles() {
  if (config.mode === 'development') return []
  const token = await auth.getAccessToken()
  if (!token) throw new Error('נדרשת התחברות מחדש')
  const response = await fetch('/api/drive/files', { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('מסמכי Drive לא נטענו')
  return (await response.json()).files || []
}

async function loadWorkspace() {
  loading = true; currentProject = null; form.hidden = true; clearError()
  tasksBox.replaceChildren(node('p', 'task-empty', 'טוען משימות…'))
  documentsBox.replaceChildren(node('p', 'task-empty', 'טוען מסמכים…'))
  if (!projectKey) { header.replaceChildren(node('h1', '', 'לא נבחר פרויקט')); showError('לא נבחר פרויקט תקין. חזרו לרשימת הפרויקטים ובחרו פרויקט.'); unavailable(tasksBox, 'המשימות אינן זמינות ללא פרויקט.'); unavailable(documentsBox, 'המסמכים אינם זמינים ללא פרויקט.'); loading = false; return }
  const [projectsResult, tasksResult, workflowsResult, filesResult] = await Promise.allSettled([
    repository.listProjects(), repository.listTasks(), repository.listDocumentWorkflows(), loadDriveFiles(),
  ])
  const states = workspacePanelStates({ project: projectsResult.status, tasks: tasksResult.status, workflows: workflowsResult.status, files: filesResult.status })
  if (states.project === 'fatal') { header.replaceChildren(node('h1', '', 'הפרויקט לא נטען')); showError('לא הצלחנו לטעון את פרטי הפרויקט. אפשר לחזור לפרויקטים או לנסות שוב.'); unavailable(tasksBox, 'המשימות אינן זמינות עד שפרטי הפרויקט ייטענו.'); unavailable(documentsBox, 'המסמכים אינם זמינים עד שפרטי הפרויקט ייטענו.'); loading = false; return }
  const workspace = buildProjectWorkspace({
    projectKey,
    projects: projectsResult.value,
    tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : [],
    workflows: workflowsResult.status === 'fulfilled' ? workflowsResult.value : [],
    files: filesResult.status === 'fulfilled' ? filesResult.value : [],
  })
  if (!workspace.project) { header.replaceChildren(node('h1', '', 'הפרויקט לא נמצא')); showError('הפרויקט שביקשת אינו זמין בחשבון הזה.'); unavailable(tasksBox, 'אין משימות להצגה.'); unavailable(documentsBox, 'אין מסמכים להצגה.'); loading = false; return }
  currentProject = workspace.project; currentTasks = workspace.tasks
  renderHeader(currentProject)
  if (states.tasks === 'ready') renderTasks(currentTasks); else unavailable(tasksBox, 'לא הצלחנו לטעון את המשימות. אין כאן תצוגת “ריק” — הנתונים פשוט אינם זמינים כרגע.')
  if (states.documents === 'unavailable') unavailable(documentsBox, 'שיוכי המסמכים אינם זמינים כרגע. נסו שוב.'); else renderDocuments(workspace.documents)
  if (states.documents === 'metadata-unavailable') showError('שיוכי המסמכים נטענו, אך פרטי הקבצים מ־Drive אינם זמינים כרגע. הפעולות השמורות עדיין מוצגות.')
  form.hidden = false; loading = false
  const warnings = []
  if (tasksResult.status === 'rejected') warnings.push('המשימות לא נטענו')
  if (workflowsResult.status === 'rejected') warnings.push('שיוכי המסמכים לא נטענו')
  if (filesResult.status === 'rejected') warnings.push('פרטי קבצי Drive לא נטענו')
  if (warnings.length && states.documents !== 'metadata-unavailable') showError(`${warnings.join(' · ')}. שאר מרחב הפרויקט זמין כרגיל.`)
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (loading || !currentProject) { feedback.textContent = 'יש להמתין עד שהפרויקט ייטען.'; return }
  if (submitting) return
  const submit = form.querySelector('button[type="submit"]')
  const data = new FormData(form)
  submitting = true; submit.disabled = true; feedback.textContent = 'יוצר משימה…'
  try {
    const task = await repository.createTask({ projectId: currentProject.id, title: data.get('title'), dueLabel: data.get('dueLabel'), priority: data.get('priority') })
    currentTasks = [task, ...currentTasks]; renderTasks(currentTasks); form.reset(); feedback.textContent = 'המשימה נוצרה ונוספה לפרויקט.'
  } catch { feedback.textContent = 'יצירת המשימה נכשלה. אפשר לנסות שוב.' }
  finally { submitting = false; submit.disabled = false }
})

await sessionReady
loadWorkspace()

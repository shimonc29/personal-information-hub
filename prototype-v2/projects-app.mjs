import { buildProjectSlug, validateProjectDraft } from './project-management.mjs'
import { deriveLiveProjectCounts, filterProjects } from './projects-model.mjs'
import { repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'

await sessionReady
let projects = []
let activeFilter = 'all'
let editingProject = null
const grid = document.querySelector('[data-projects-grid]')
const filters = document.querySelectorAll('[data-filter]')
const search = document.querySelector('#project-search')
const dialog = document.querySelector('[data-project-dialog]')
const form = document.querySelector('[data-project-form]')
const toast = document.querySelector('.toast')

function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node }
function notify(message) { toast.textContent = message; toast.classList.add('is-visible'); setTimeout(() => toast.classList.remove('is-visible'), 2800) }

function projectCard(project) {
  const card = element('article', 'project-card catalog-card')
  card.dataset.status = project.status
  const header = element('div', 'project-card__header')
  header.append(element('span', `project-icon project-icon--${project.tone}`, project.name.charAt(0)), element('span', `status-pill status-pill--${project.status}`, project.statusLabel))
  const stats = element('div', 'project-stats')
  stats.append(element('span', '', `▤ ${project.documents} מסמכים`), element('span', '', `✓ ${project.tasks} משימות פתוחות`))
  const next = element('div', 'next-action next-action--plain')
  const nextCopy = element('div'); nextCopy.append(element('span', '', 'הפעולה הבאה'), element('strong', '', project.next || 'טרם הוגדרה פעולה'))
  next.append(nextCopy)
  const actions = element('div', 'project-card__actions')
  const open = element('a', 'card-link', 'פתיחת הפרויקט ←'); open.href = `./project.html?project=${encodeURIComponent(project.id)}`
  const edit = element('button', 'project-edit', 'עריכה'); edit.type = 'button'; edit.addEventListener('click', () => openProjectDialog(project))
  actions.append(open, edit)
  if (project.status !== 'archived') { const archive = element('button', 'project-archive', 'ארכוב'); archive.type = 'button'; archive.addEventListener('click', () => archiveProject(project)); actions.append(archive) }
  card.append(header, element('h3', '', project.name), element('p', '', project.client || 'ללא לקוח'), stats, next, actions)
  return card
}

function render() {
  const query = search.value.trim().toLowerCase()
  const visible = filterProjects(projects, activeFilter).filter((project) => `${project.name} ${project.client}`.toLowerCase().includes(query))
  grid.replaceChildren(...visible.map(projectCard))
  if (!visible.length) grid.append(element('p', 'task-empty', 'לא נמצאו פרויקטים בתצוגה הזו.'))
  document.querySelector('[data-result-count]').textContent = `${visible.length} פרויקטים`
  document.querySelector('[data-project-total]').textContent = projects.filter((project) => !['completed', 'archived'].includes(project.status)).length
  document.querySelector('[data-attention-total]').textContent = projects.filter((project) => ['waiting', 'planning'].includes(project.status)).length
}

function openProjectDialog(project = null) {
  editingProject = project
  form.reset()
  document.querySelector('[data-dialog-title]').textContent = project ? 'עריכת פרויקט' : 'פרויקט חדש'
  if (project) { form.elements.name.value = project.name; form.elements.client.value = project.client; form.elements.description.value = project.description; form.elements.nextAction.value = project.next; form.elements.status.value = project.status }
  document.querySelector('[data-project-feedback]').textContent = ''
  dialog.showModal()
}

async function archiveProject(project) {
  if (!confirm(`להעביר את „${project.name}” לארכיון?`)) return
  try { const updated = await repository.updateProject(project.databaseId, { status: 'archived' }); projects = projects.map((item) => item.databaseId === updated.databaseId ? { ...item, ...updated } : item); render(); notify('הפרויקט הועבר לארכיון') }
  catch { notify('לא הצלחנו להעביר לארכיון. נסו שוב.') }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const values = Object.fromEntries(new FormData(form))
  const submit = document.querySelector('[data-project-submit]'); submit.disabled = true
  try {
    const draft = validateProjectDraft(values)
    let saved
    if (editingProject) saved = await repository.updateProject(editingProject.databaseId, draft)
    else saved = await repository.createProject({ ...draft, slug: buildProjectSlug(draft.name, crypto.randomUUID().slice(0, 8)), tone: 'blue' })
    projects = editingProject ? projects.map((item) => item.databaseId === saved.databaseId ? { ...item, ...saved } : item) : [saved, ...projects]
    dialog.close(); render(); notify(editingProject ? 'השינויים נשמרו' : 'הפרויקט נוצר')
  } catch { document.querySelector('[data-project-feedback]').textContent = 'לא הצלחנו לשמור. בדקו את הפרטים ונסו שוב.' }
  finally { submit.disabled = false }
})

document.querySelector('[data-new-project]').addEventListener('click', () => openProjectDialog())
document.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close())
document.querySelector('[data-dialog-cancel]').addEventListener('click', () => dialog.close())
filters.forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; filters.forEach((item) => item.classList.toggle('is-active', item === button)); render() }))
search.addEventListener('input', render)

async function loadProjects() {
  grid.replaceChildren(element('p', 'task-empty', 'טוען פרויקטים…'))
  try {
    const [projectsResult, tasksResult, workflowsResult] = await Promise.allSettled([repository.listProjects(), repository.listTasks(), repository.listDocumentWorkflows()])
    if (projectsResult.status === 'rejected') throw projectsResult.reason
    projects = deriveLiveProjectCounts(projectsResult.value, { tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : [], workflows: workflowsResult.status === 'fulfilled' ? workflowsResult.value : [], tasksAvailable: tasksResult.status === 'fulfilled', workflowsAvailable: workflowsResult.status === 'fulfilled' })
    render()
  } catch { const retry = element('button', 'primary-button', 'ניסיון נוסף'); retry.addEventListener('click', loadProjects); grid.replaceChildren(element('p', 'task-empty', 'לא הצלחנו לטעון את הפרויקטים.'), retry) }
}
loadProjects()

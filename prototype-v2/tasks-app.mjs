import { repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'
import { classifyTask, filterTasks, formatTaskDate, toDateInput, toDueAt } from './tasks-model.mjs'

await sessionReady
const list = document.querySelector('[data-tasks-list]')
const count = document.querySelector('[data-task-count]')
const form = document.querySelector('[data-task-form]')
const projectSelect = document.querySelector('[data-project-select]')
const toast = document.querySelector('.toast')
let tasks = []
let projects = []
let activeFilter = 'open'

const priorityLabel = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', נמוכה: 'נמוכה', בינונית: 'בינונית', גבוהה: 'גבוהה' }
const projectFor = (task) => projects.find((project) => project.databaseId === task.projectId || project.id === task.projectId)

function notify(message) {
  toast.textContent = message
  toast.classList.add('is-visible')
  setTimeout(() => toast.classList.remove('is-visible'), 2800)
}

function taskRow(task) {
  const project = projectFor(task)
  const row = document.createElement('article')
  row.className = `task-card task-card--${classifyTask(task)}`
  row.dataset.taskId = task.id

  const complete = document.createElement('button')
  complete.className = 'task-complete'
  complete.type = 'button'
  complete.setAttribute('aria-label', task.completedAt ? `פתיחת המשימה ${task.title}` : `סימון המשימה ${task.title} כהושלמה`)
  complete.textContent = task.completedAt ? '↶' : '✓'
  complete.addEventListener('click', () => changeTask(task.id, { completedAt: task.completedAt ? null : new Date().toISOString() }, task.completedAt ? 'המשימה נפתחה מחדש' : 'המשימה הושלמה'))

  const body = document.createElement('div')
  body.className = 'task-card__body'
  const title = document.createElement('strong')
  title.textContent = task.title
  const meta = document.createElement('div')
  meta.className = 'task-card__meta'
  const date = document.createElement('span')
  date.textContent = formatTaskDate(task.dueAt)
  const priority = document.createElement('span')
  priority.className = `priority priority--${Object.entries(priorityLabel).find(([, label]) => label === priorityLabel[task.priority])?.[0] ?? 'medium'}`
  priority.textContent = priorityLabel[task.priority] ?? task.priority
  meta.append(date, priority)
  if (project) {
    const link = document.createElement('a')
    link.href = `./project.html?project=${encodeURIComponent(project.id)}`
    link.textContent = project.name
    meta.prepend(link)
  }
  body.append(title, meta)

  const actions = document.createElement('div')
  actions.className = 'task-card__actions'
  const edit = document.createElement('button')
  edit.type = 'button'; edit.textContent = 'עריכה'
  edit.addEventListener('click', () => editTask(task, row))
  const remove = document.createElement('button')
  remove.type = 'button'; remove.className = 'danger-link'; remove.textContent = 'מחיקה'
  remove.addEventListener('click', () => deleteTask(task))
  actions.append(edit, remove)
  row.append(complete, body, actions)
  return row
}

function renderTasks() {
  const visible = filterTasks(tasks, activeFilter)
  count.textContent = `${visible.length} משימות`
  list.replaceChildren(...visible.map(taskRow))
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'task-empty'; empty.textContent = 'אין משימות בתצוגה הזו.'; list.append(empty)
  }
}

async function changeTask(taskId, changes, message) {
  try {
    const updated = await repository.updateTask(taskId, changes)
    tasks = tasks.map((task) => task.id === taskId ? updated : task)
    renderTasks(); notify(message)
  } catch { notify('לא הצלחנו לעדכן. נסו שוב.') }
}

function editTask(task, row) {
  const body = row.querySelector('.task-card__body')
  const editor = document.createElement('form')
  editor.className = 'task-inline-editor'
  editor.innerHTML = `<label>כותרת<input name="title" maxlength="200" required></label><label>תאריך יעד<input name="dueDate" type="date"></label><label>עדיפות<select name="priority"><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="low">נמוכה</option></select></label><button type="submit" class="primary-button">שמירה</button><button type="button" data-cancel>ביטול</button>`
  editor.elements.title.value = task.title
  editor.elements.dueDate.value = toDateInput(task.dueAt)
  editor.elements.priority.value = Object.keys(priorityLabel).find((key) => ['low', 'medium', 'high'].includes(key) && priorityLabel[key] === priorityLabel[task.priority]) ?? 'medium'
  editor.querySelector('[data-cancel]').addEventListener('click', renderTasks)
  editor.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(editor)
    await changeTask(task.id, { title: values.get('title'), dueAt: toDueAt(values.get('dueDate')), priority: values.get('priority') }, 'השינויים נשמרו')
  })
  body.replaceChildren(editor)
  row.querySelector('.task-card__actions').replaceChildren()
}

async function deleteTask(task) {
  if (!confirm(`למחוק את המשימה „${task.title}”?`)) return
  try {
    await repository.deleteTask(task.id)
    tasks = tasks.filter((item) => item.id !== task.id)
    renderTasks(); notify('המשימה נמחקה')
  } catch { notify('לא הצלחנו למחוק. נסו שוב.') }
}

document.querySelectorAll('[data-task-filter]').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.taskFilter
  document.querySelectorAll('[data-task-filter]').forEach((item) => item.classList.toggle('is-active', item === button))
  renderTasks()
}))

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const values = new FormData(form)
  const submit = form.querySelector('button[type="submit"]')
  submit.disabled = true
  try {
    const created = await repository.createTask({ projectId: values.get('projectId'), title: values.get('title'), dueAt: toDueAt(values.get('dueDate')), priority: values.get('priority') })
    tasks.unshift(created); form.reset(); renderTasks(); notify('המשימה נוצרה')
  } catch { notify('לא הצלחנו ליצור את המשימה. נסו שוב.') }
  finally { submit.disabled = false }
})

try {
  ;[projects, tasks] = await Promise.all([repository.listProjects(), repository.listTasks()])
  projectSelect.replaceChildren(...projects.filter((project) => project.status !== 'completed').map((project) => {
    const option = document.createElement('option'); option.value = project.id; option.textContent = project.name; return option
  }))
  renderTasks()
} catch {
  list.textContent = 'לא הצלחנו לטעון את המשימות. נסו לרענן את העמוד.'
  count.textContent = 'שגיאה בטעינה'
  form.querySelector('button[type="submit"]').disabled = true
}

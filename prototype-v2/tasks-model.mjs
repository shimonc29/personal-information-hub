const dayKey = (value) => {
  if (value == null || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function classifyTask(task, now = new Date()) {
  if (task.completedAt) return 'completed'
  if (!task.dueAt) return 'later'
  const due = dayKey(task.dueAt)
  const today = dayKey(now)
  if (!due || !today) return 'later'
  const days = Math.round((due - today) / 86400000)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  return days <= 7 ? 'week' : 'later'
}

export function filterTasks(tasks, filter = 'open', now = new Date()) {
  return tasks.filter((task) => {
    const group = classifyTask(task, now)
    if (filter === 'all') return true
    if (filter === 'open') return group !== 'completed'
    return group === filter
  })
}

export function toDueAt(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? `${value}T12:00:00` : null
}

export function toDateInput(value) {
  const date = dayKey(value)
  if (!date) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatTaskDate(value, now = new Date()) {
  const date = dayKey(value)
  if (!date) return 'ללא תאריך'
  const group = classifyTask({ dueAt: value }, now)
  if (group === 'today') return 'היום'
  return new Intl.DateTimeFormat('he-IL').format(date)
}

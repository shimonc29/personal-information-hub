import { projectStatusLabel, validateProjectDraft } from './project-management.mjs'
import { validateInformationArea } from './information-areas.mjs'

function mapTask(input) {
  return {
    project_id: input.projectId,
    title: input.title.trim(),
    due_label: input.dueLabel ?? '',
    due_at: input.dueAt ?? null,
    priority: input.priority ?? 'medium',
  }
}

const priorityToDatabase = { 'נמוכה': 'low', 'בינונית': 'medium', 'גבוהה': 'high', low: 'low', medium: 'medium', high: 'high' }
const priorityToUi = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה' }
const mapProject = (row) => ({ id: row.slug, databaseId: row.id, name: row.name, client: row.client, description: row.description ?? '', status: row.status, statusLabel: row.status_label || projectStatusLabel(row.status), documents: row.documents_count, people: row.people_count, tasks: row.tasks_count, next: row.next_action, updated: row.updated_label, tone: row.tone })
const mapTaskRow = (row) => ({ id: row.id, projectId: row.project_id, title: row.title, dueLabel: row.due_label, dueAt: row.due_at ?? null, priority: priorityToUi[row.priority] ?? row.priority, completedAt: row.completed_at ?? null, createdAt: row.created_at })
const mapDocumentWorkflowRow = (row) => ({ id: row.id, driveFileId: row.drive_file_id, projectId: row.project_id, informationAreaId: row.information_area_id ?? null, nextAction: row.next_action, handled: row.handled, updatedAt: row.updated_at })
const mapInformationAreaRow = (row) => ({ id: row.id, name: row.name, description: row.description ?? '', tone: row.tone, icon: row.icon, archivedAt: row.archived_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at })

function validateTaskInput(input) {
  if (typeof input?.projectId !== 'string' || !input.projectId) throw new Error('Project ID is required')
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) throw new Error('Task title must be between 1 and 200 characters')
  if (input.dueLabel != null && (typeof input.dueLabel !== 'string' || input.dueLabel.length > 80)) throw new Error('Task due label must be at most 80 characters')
  if (input.priority != null && !Object.hasOwn(priorityToDatabase, input.priority)) throw new Error('Task priority is not supported')
}

export function createSupabaseRepository({ url, anonKey, getAccessToken, fetchImpl = fetch }) {
  async function request(path, options = {}) {
    const token = await getAccessToken()
    if (!token) throw new Error('Authentication is required')
    const response = await fetchImpl(`${url}/rest/v1/${path}`, {
      ...options,
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers },
    })
    if (!response.ok) throw new Error(`Supabase request failed (${response.status})`)
    return response.status === 204 ? null : response.json()
  }

  return {
    async listProjects() { return (await request('projects?select=*&order=updated_at.desc')).map(mapProject) },
    async createProject(input) {
      const draft = validateProjectDraft(input)
      if (typeof input.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.slug)) throw new Error('Project slug is invalid')
      const payload = { slug: input.slug, name: draft.name, client: draft.client, description: draft.description, status: draft.status, status_label: projectStatusLabel(draft.status), next_action: draft.nextAction, tone: input.tone || 'blue', updated_label: 'היום' }
      const rows = await request('projects', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      return mapProject(rows[0])
    },
    async updateProject(projectId, changes) {
      if (typeof projectId !== 'string' || !projectId) throw new Error('Project ID is required')
      const payload = {}
      if (changes.name != null) {
        if (typeof changes.name !== 'string' || !changes.name.trim() || changes.name.trim().length > 200) throw new Error('Project name is invalid')
        payload.name = changes.name.trim()
      }
      if (changes.client != null) payload.client = String(changes.client).trim().slice(0, 200)
      if (changes.description != null) payload.description = String(changes.description).trim().slice(0, 2000)
      if (changes.nextAction != null) payload.next_action = String(changes.nextAction).trim().slice(0, 500)
      if (changes.status != null) {
        if (!projectStatusLabel(changes.status)) throw new Error('Project status is not supported')
        payload.status = changes.status
        payload.status_label = projectStatusLabel(changes.status)
      }
      if (!Object.keys(payload).length) throw new Error('Project changes are required')
      const rows = await request(`projects?id=eq.${encodeURIComponent(projectId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      if (!rows[0]) throw new Error('Project does not exist')
      return mapProject(rows[0])
    },
    async listTasks() { return (await request('tasks?select=*&order=created_at.desc')).map(mapTaskRow) },
    async createTask(input) {
      validateTaskInput(input)
      const projects = await request(`projects?slug=eq.${encodeURIComponent(input.projectId)}&select=id`)
      if (!projects[0]) throw new Error('Project does not exist')
      const payload = mapTask({ ...input, projectId: projects[0].id })
      payload.priority = priorityToDatabase[input.priority] ?? 'medium'
      const rows = await request('tasks', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      return mapTaskRow(rows[0])
    },
    async updateTask(taskId, changes) {
      if (typeof taskId !== 'string' || !taskId) throw new Error('Task ID is required')
      const payload = {}
      if (changes.title != null) {
        if (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.trim().length > 200) throw new Error('Task title must be between 1 and 200 characters')
        payload.title = changes.title.trim()
      }
      if ('dueAt' in changes) payload.due_at = changes.dueAt || null
      if (changes.priority != null) {
        if (!Object.hasOwn(priorityToDatabase, changes.priority)) throw new Error('Task priority is not supported')
        payload.priority = priorityToDatabase[changes.priority]
      }
      if ('completedAt' in changes) payload.completed_at = changes.completedAt || null
      if (!Object.keys(payload).length) throw new Error('Task changes are required')
      const rows = await request(`tasks?id=eq.${encodeURIComponent(taskId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      if (!rows[0]) throw new Error('Task does not exist')
      return mapTaskRow(rows[0])
    },
    async deleteTask(taskId) {
      if (typeof taskId !== 'string' || !taskId) throw new Error('Task ID is required')
      return request(`tasks?id=eq.${encodeURIComponent(taskId)}`, { method: 'DELETE' })
    },
    async listDocumentWorkflows() {
      return (await request('document_workflows?select=*&order=updated_at.desc')).map(mapDocumentWorkflowRow)
    },
    async listInformationAreas({ includeArchived = false } = {}) {
      const filter = includeArchived ? '' : '&archived_at=is.null'
      return (await request(`information_areas?select=*${filter}&order=updated_at.desc`)).map(mapInformationAreaRow)
    },
    async createInformationArea(input) {
      const payload = validateInformationArea(input)
      const rows = await request('information_areas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      return mapInformationAreaRow(rows[0])
    },
    async updateInformationArea(areaId, changes) {
      if (typeof areaId !== 'string' || !areaId) throw new Error('Area ID is required')
      const current = { name: changes.name, description: changes.description ?? '', tone: changes.tone ?? 'sage', icon: changes.icon ?? 'מידע' }
      const payload = validateInformationArea(current)
      if ('archivedAt' in changes) payload.archived_at = changes.archivedAt || null
      const rows = await request(`information_areas?id=eq.${encodeURIComponent(areaId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      if (!rows[0]) throw new Error('Information area does not exist')
      return mapInformationAreaRow(rows[0])
    },
    async saveDocumentWorkflow(input) {
      if (typeof input.driveFileId !== 'string' || !input.driveFileId || input.driveFileId.length > 500) throw new Error('Drive file ID must be between 1 and 500 characters')
      if (typeof input.nextAction !== 'string' || input.nextAction.length > 500) throw new Error('Next action must be at most 500 characters')
      const payload = {
        drive_file_id: input.driveFileId,
        project_id: input.projectId || null,
        next_action: input.nextAction.trim(),
        handled: Boolean(input.handled),
      }
      if ('informationAreaId' in input) payload.information_area_id = input.informationAreaId || null
      const rows = await request('document_workflows?on_conflict=user_id%2Cdrive_file_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
      })
      return mapDocumentWorkflowRow(rows[0])
    },
    async deleteDocumentWorkflow(driveFileId) {
      return request(`document_workflows?drive_file_id=eq.${encodeURIComponent(driveFileId)}`, { method: 'DELETE' })
    },
  }
}

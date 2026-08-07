import { createSupabaseRepository } from './supabase-repository.mjs'

function localRequest(fetchImpl, path, options) {
  return fetchImpl(`./api/${path}`, options).then(async (response) => {
    if (!response.ok) throw new Error(`Local API failed (${response.status})`)
    return response.json()
  })
}

export function createBrowserRepository({ config, getAccessToken, fetchImpl = fetch }) {
  if (config.mode === 'development') return {
    kind: 'development-local',
    listProjects: () => localRequest(fetchImpl, 'projects'),
    createProject: (project) => localRequest(fetchImpl, 'projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) }),
    updateProject: (projectId, changes) => localRequest(fetchImpl, `projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) }),
    listTasks: () => localRequest(fetchImpl, 'tasks'),
    createTask: (task) => localRequest(fetchImpl, 'tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(task) }),
    updateTask: (taskId, changes) => localRequest(fetchImpl, `tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) }),
    deleteTask: (taskId) => localRequest(fetchImpl, `tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' }),
    listDocumentWorkflows: async () => [],
    saveDocumentWorkflow: async (workflow) => workflow,
    deleteDocumentWorkflow: async () => null,
    listInformationAreas: async () => [],
    createInformationArea: async (area) => ({ ...area, id: crypto.randomUUID(), archivedAt: null }),
    updateInformationArea: async (areaId, changes) => ({ ...changes, id: areaId }),
  }
  return createSupabaseRepository({ url: config.supabaseUrl, anonKey: config.supabaseAnonKey, getAccessToken, fetchImpl })
}

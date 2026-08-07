import { safeDriveUrl } from './document-workflow.mjs'

export function normalizeProjectKey(search = '') {
  const value = new URLSearchParams(search).get('project')?.trim()
  return value && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(value) ? value : null
}

export function buildProjectWorkspace({ projectKey, projects = [], tasks = [], workflows = [], files = [] }) {
  const project = projects.find((item) => item.id === projectKey) ?? null
  if (!project) return { project: null, tasks: [], documents: [] }
  const projectId = project.databaseId ?? project.id
  const fileById = new Map(files.map((file) => [file.id, file]))
  const documents = workflows
    .filter((workflow) => workflow.projectId === projectId)
    .map((workflow) => {
      const file = fileById.get(workflow.driveFileId)
      return {
        id: workflow.driveFileId,
        name: file?.name ?? 'מסמך Drive לא זמין',
        mimeType: file?.mimeType ?? '',
        modifiedTime: file?.modifiedTime ?? null,
        nextAction: workflow.nextAction ?? '',
        handled: Boolean(workflow.handled),
        safeUrl: safeDriveUrl(file?.webViewLink),
      }
    })
  return {
    project,
    tasks: tasks.filter((task) => !task.completedAt && (task.projectId === projectId || task.projectId === project.id)),
    documents,
  }
}

export function workspacePanelStates(statuses) {
  if (statuses.project === 'rejected') return { project: 'fatal', tasks: 'unavailable', documents: 'unavailable' }
  return {
    project: 'ready',
    tasks: statuses.tasks === 'fulfilled' ? 'ready' : 'unavailable',
    documents: statuses.workflows !== 'fulfilled' ? 'unavailable' : statuses.files === 'fulfilled' ? 'ready' : 'metadata-unavailable',
  }
}

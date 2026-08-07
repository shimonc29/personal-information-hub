export function mergeDriveWorkflows(files, workflows) {
  const byFileId = new Map(workflows.map((workflow) => [workflow.driveFileId, workflow]))
  return files.map((file) => ({
    ...file,
    workflow: byFileId.get(file.id) ?? { driveFileId: file.id, projectId: null, informationAreaId: null, nextAction: '', handled: false },
  }))
}

export function filterDocumentInbox(files, status = 'inbox') {
  if (status === 'all') return files
  if (status === 'handled') return files.filter((file) => file.workflow.handled)
  return files.filter((file) => !file.workflow.handled)
}

export function applyWorkflowDrafts(files, drafts) {
  return files.map((file) => {
    const draft = drafts.get(file.id)
    return draft ? { ...file, workflow: { ...file.workflow, ...draft } } : file
  })
}

export function safeDriveUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname) ? url.href : null
  } catch {
    return null
  }
}

function connectionErrorKind(error) {
  const code = error?.code || ''
  const message = error?.message || ''
  if (code === 'PGRST205' || code === '42P01' || /Supabase request failed \(404\)/i.test(message)) return 'setup'
  if (/\((401|403)\)/.test(message)) return 'authorization'
  return 'transient'
}

export function workflowFeedbackMessage(fileName, operation) {
  if (operation === 'handle') return `המסמך „${fileName}” סומן כטופל.`
  if (operation === 'reopen') return `המסמך „${fileName}” הוחזר לטיפול.`
  return `הפעולה עבור „${fileName}” נשמרה.`
}

export async function loadWorkflowContext(repository) {
  const [projectsResult, workflowsResult, areasResult] = await Promise.allSettled([
    repository.listProjects(),
    repository.listDocumentWorkflows(),
    typeof repository.listInformationAreas === 'function' ? repository.listInformationAreas() : Promise.resolve([]),
  ])
  const projectsAvailable = projectsResult.status === 'fulfilled'
  const workflowsAvailable = workflowsResult.status === 'fulfilled'
  return {
    projects: projectsResult.status === 'fulfilled' ? projectsResult.value : [],
    workflows: workflowsResult.status === 'fulfilled' ? workflowsResult.value : [],
    areas: areasResult.status === 'fulfilled' ? areasResult.value : [],
    projectsAvailable,
    workflowsAvailable,
    areasAvailable: areasResult.status === 'fulfilled',
    editingAvailable: projectsAvailable && workflowsAvailable,
    projectErrorKind: projectsAvailable ? null : connectionErrorKind(projectsResult.reason),
    workflowErrorKind: workflowsAvailable ? null : connectionErrorKind(workflowsResult.reason),
  }
}

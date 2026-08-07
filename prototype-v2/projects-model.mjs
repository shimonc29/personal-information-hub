export function createProjectsModel() {
  return [
    { id: 'akim', name: 'סדנת AI לאקים', client: 'אקים ישראל', status: 'waiting', statusLabel: 'ממתין לאישור', documents: 8, people: 3, tasks: 2, next: 'לחזור ללקוח בנוגע להצעה', updated: 'לפני 4 ימים', tone: 'violet' },
    { id: 'heritage-184', name: 'מערכת מורשת גדוד 184', client: 'עמותת מורשת 184', status: 'planning', statusLabel: 'בתכנון', documents: 17, people: 4, tasks: 6, next: 'עדכון מסמך האפיון', updated: 'היום', tone: 'blue' },
    { id: 'ariel', name: 'אריאל גינון', client: 'אריאל גינון ופיתוח', status: 'active', statusLabel: 'מתקדם', documents: 11, people: 2, tasks: 3, next: 'שליחת דף ההדגמה', updated: 'לפני שעה', tone: 'green' },
    { id: 'family-center', name: 'מרכז משפחתי', client: 'יוזמה קהילתית', status: 'planning', statusLabel: 'בתכנון', documents: 5, people: 6, tasks: 4, next: 'לקבוע פגישת התנעה', updated: 'אתמול', tone: 'amber' },
    { id: 'garinim', name: 'גרעינים תורניים', client: 'עמותת גרעינים', status: 'waiting', statusLabel: 'ממתין למשוב', documents: 13, people: 5, tasks: 1, next: 'לקבל אישור למסמך', updated: 'לפני 3 ימים', tone: 'coral' },
    { id: 'melodies', name: 'אתר מנגינות', client: 'מנגינות ישראל', status: 'complete', statusLabel: 'הושלם', documents: 22, people: 3, tasks: 0, next: 'אין משימות פתוחות', updated: 'לפני שבוע', tone: 'gray' },
  ]
}

export function filterProjects(projects, status) {
  if (status === 'all') return projects.filter((project) => project.status !== 'archived')
  return projects.filter((project) => project.status === (status === 'complete' ? 'completed' : status))
}

export function deriveLiveProjectCounts(projects, { tasks = [], workflows = [], tasksAvailable = false, workflowsAvailable = false } = {}) {
  return projects.map((project) => {
    const projectIds = new Set([project.id, project.databaseId].filter(Boolean))
    return {
      ...project,
      tasks: tasksAvailable ? tasks.filter((task) => !task.completedAt && projectIds.has(task.projectId)).length : project.tasks,
      documents: workflowsAvailable ? workflows.filter((workflow) => projectIds.has(workflow.projectId)).length : project.documents,
    }
  })
}

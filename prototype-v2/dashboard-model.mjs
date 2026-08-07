const initialTasks = [
  {
    id: 'send-ariel-demo',
    title: 'לשלוח מסמך מעודכן לאריאל',
    dueLabel: 'מחר',
    project: 'אריאל גינון',
    priority: 'בינונית',
  },
]

export function createDashboardModel() {
  return {
    attention: {
      unansweredQuotes: 3,
      overdueTasks: 5,
      unclassifiedDocuments: 2,
    },
    tasks: [...initialTasks],
    toast: '',
  }
}

export function createFollowUpTask(model, projectId) {
  if (projectId !== 'akim' || model.tasks.some((task) => task.id === 'akim-follow-up')) {
    return model
  }

  return {
    ...model,
    attention: {
      ...model.attention,
      unansweredQuotes: Math.max(0, model.attention.unansweredQuotes - 1),
    },
    tasks: [
      {
        id: 'akim-follow-up',
        title: 'לחזור לאקים בנוגע להצעת המחיר',
        dueLabel: 'היום',
        project: 'סדנת AI לאקים',
        priority: 'גבוהה',
      },
      ...model.tasks,
    ],
    toast: 'משימת המעקב נוצרה',
  }
}

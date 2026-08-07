const allowedStatuses = new Set(['planning', 'active', 'waiting', 'completed', 'archived'])
const labels = { planning: 'בתכנון', active: 'פעיל', waiting: 'ממתין', completed: 'הושלם', archived: 'בארכיון' }

export const projectStatusLabel = (status) => labels[status] ?? ''

export function buildProjectSlug(name, suffix) {
  const base = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54)
  return `${base || 'project'}-${String(suffix).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12)}`
}

export function validateProjectDraft(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 200) throw new Error('Project name must be between 1 and 200 characters')
  if (!allowedStatuses.has(input.status)) throw new Error('Project status is not supported')
  const client = typeof input.client === 'string' ? input.client.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const nextAction = typeof input.nextAction === 'string' ? input.nextAction.trim() : ''
  if (client.length > 200 || description.length > 2000 || nextAction.length > 500) throw new Error('Project field is too long')
  return { name, client, description, status: input.status, nextAction }
}

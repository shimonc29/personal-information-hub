const tones = new Set(['sage', 'blue', 'amber', 'violet', 'coral'])

export function validateInformationArea(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 80) throw new Error('Area name must be between 1 and 80 characters')
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > 500) throw new Error('Area description must be at most 500 characters')
  const icon = typeof input.icon === 'string' && input.icon.trim() ? input.icon.trim().slice(0, 12) : 'מידע'
  const tone = tones.has(input.tone) ? input.tone : 'sage'
  return { name, description, tone, icon }
}

export function buildOrganizationPlan({ selectedIds, files, area }) {
  if (!area?.id || !area?.name) throw new Error('An information area is required')
  const selected = files.filter((file) => selectedIds.has(file.id)).sort((a, b) => a.name.localeCompare(b.name, 'he'))
  if (!selected.length) throw new Error('At least one file is required')
  return { areaId: area.id, areaName: area.name, files: selected, driveMutation: false }
}

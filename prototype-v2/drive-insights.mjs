const kinds = ['documents', 'sheets', 'forms', 'images', 'videos', 'pdf', 'folders', 'other']

export function classifyDriveFile(file) {
  const type = file?.mimeType || ''
  if (type === 'application/vnd.google-apps.document' || type.includes('wordprocessingml') || type === 'application/msword') return 'documents'
  if (type === 'application/vnd.google-apps.spreadsheet' || type.includes('spreadsheetml') || type === 'application/vnd.ms-excel') return 'sheets'
  if (type === 'application/vnd.google-apps.form') return 'forms'
  if (type.startsWith('image/')) return 'images'
  if (type.startsWith('video/')) return 'videos'
  if (type === 'application/pdf') return 'pdf'
  if (type === 'application/vnd.google-apps.folder') return 'folders'
  return 'other'
}

export function analyzeDriveFiles(files = [], now = new Date()) {
  const counts = Object.fromEntries(kinds.map((kind) => [kind, 0]))
  const names = new Map()
  let stale = 0
  let large = 0
  const staleBefore = now.getTime() - 365 * 86400000
  for (const file of files) {
    counts[classifyDriveFile(file)] += 1
    const modified = new Date(file.modifiedTime).getTime()
    if (Number.isFinite(modified) && modified < staleBefore) stale += 1
    if (Number(file.size) >= 50 * 1024 * 1024) large += 1
    const name = String(file.name ?? '').trim().toLocaleLowerCase('he-IL')
    if (name) names.set(name, (names.get(name) ?? 0) + 1)
  }
  return { total: files.length, counts, stale, large, duplicateGroups: [...names.values()].filter((value) => value > 1).length }
}

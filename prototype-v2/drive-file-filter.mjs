export function driveFileKind(file) {
  const mimeType = file?.mimeType || ''
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'sheets'
  if (mimeType === 'application/vnd.google-apps.document') return 'docs'
  if (mimeType === 'application/vnd.google-apps.folder') return 'folders'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'other'
}

export function filterDriveFiles(files, { query = '', kind = 'all', insight = 'all', now = new Date() } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase('he-IL')
  const staleBefore = now.getTime() - 365 * 86400000
  const nameCounts = new Map()
  for (const file of files) {
    const name = String(file.name ?? '').trim().toLocaleLowerCase('he-IL')
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  return files.filter((file) => {
    const matchesName = !normalizedQuery || file.name.toLocaleLowerCase('he-IL').includes(normalizedQuery)
    const matchesKind = kind === 'all' || driveFileKind(file) === kind
    const normalizedName = String(file.name ?? '').trim().toLocaleLowerCase('he-IL')
    const matchesInsight = insight === 'all'
      || (insight === 'stale' && Number.isFinite(new Date(file.modifiedTime).getTime()) && new Date(file.modifiedTime).getTime() < staleBefore)
      || (insight === 'large' && Number(file.size) >= 50 * 1024 * 1024)
      || (insight === 'duplicates' && (nameCounts.get(normalizedName) ?? 0) > 1)
    return matchesName && matchesKind && matchesInsight
  })
}

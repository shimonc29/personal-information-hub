export function validateProject(input) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const parentProjectId = typeof input?.parentProjectId === "string" ? input.parentProjectId.trim() : "";
  if (!name || name.length > 200) throw new Error("Project name must contain 1-200 characters");
  if (description.length > 2000) throw new Error("Project description is too long");
  return parentProjectId ? { name, description, parentProjectId } : { name, description };
}

export function parseAssignmentSuggestions(text, fileIds, projectIds) {
  try {
    const json = text.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
    return JSON.parse(json).filter((item) => fileIds.has(item.fileId) && projectIds.has(item.projectId)).map((item) => ({ fileId: item.fileId, projectId: item.projectId, reason: String(item.reason ?? "").slice(0, 240) }));
  } catch { return []; }
}

export async function fetchAllDriveFiles(accessToken, fetchImpl = fetch) {
  const files = [];
  let pageToken;
  do {
    const url = new URL("/api/drive/files", globalThis.location?.origin ?? "http://localhost");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetchImpl(url.pathname + url.search, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(response.status === 409 ? "צריך לחבר מחדש את Google Drive." : "לא הצלחנו לטעון את הקבצים מה־Drive.");
    const page = await response.json();
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

export function toDocument(file) {
  const mime = file.mimeType ?? "";
  const type = mime.includes("spreadsheet") ? "SHEET" : mime.includes("presentation") ? "SLIDE" : mime.includes("document") ? "DOC" : mime.includes("folder") ? "FOLDER" : mime.includes("pdf") ? "PDF" : mime.split("/").pop()?.toUpperCase().slice(0, 8) || "FILE";
  const tone = type === "PDF" ? "pdf" : type === "SHEET" ? "xls" : type === "SLIDE" ? "sld" : "doc";
  return { id: file.id, title: file.name, type, tone, project: "Google Drive", person: "—", date: file.modifiedTime ? new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(file.modifiedTime)) : "—", url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`, mimeType: mime };
}

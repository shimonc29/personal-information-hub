import assert from "node:assert/strict";
import test from "node:test";
import { fetchAllDriveFiles, toDocument } from "../lib/drive-client.mjs";

test("fetchAllDriveFiles follows every Drive page", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const secondPage = String(url).includes("pageToken=next-page");
    return new Response(JSON.stringify(secondPage
      ? { files: [{ id: "2", name: "Second", mimeType: "application/pdf", modifiedTime: "2026-08-15T10:00:00Z", webViewLink: "https://drive.google.com/2" }] }
      : { files: [{ id: "1", name: "First", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-08-16T10:00:00Z", webViewLink: "https://drive.google.com/1" }], nextPageToken: "next-page" }));
  };

  const files = await fetchAllDriveFiles("session-token", fetchImpl);

  assert.deepEqual(files.map((file) => file.id), ["1", "2"]);
  assert.equal(requested.length, 2);
  assert.match(requested[1], /pageToken=next-page/);
});

test("toDocument makes a Drive file searchable and openable", () => {
  const document = toDocument({ id: "abc", name: "תוכנית עבודה", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-08-16T10:00:00Z", webViewLink: "https://drive.google.com/abc" });

  assert.equal(document.title, "תוכנית עבודה");
  assert.equal(document.type, "SHEET");
  assert.equal(document.url, "https://drive.google.com/abc");
  assert.equal(document.id, "abc");
});

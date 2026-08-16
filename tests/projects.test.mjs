import assert from "node:assert/strict";
import test from "node:test";
import { validateProject, parseAssignmentSuggestions } from "../lib/projects.mjs";

test("validateProject creates a clean project draft", () => {
  assert.deepEqual(validateProject({ name: "  אתר חדש  ", description: " מסמכי האתר " }), { name: "אתר חדש", description: "מסמכי האתר" });
  assert.throws(() => validateProject({ name: "" }), /name/i);
});

test("validateProject accepts a parent project for subprojects", () => {
  assert.deepEqual(validateProject({ name: "לקוח א", description: "פעיל", parentProjectId: "parent-123" }), { name: "לקוח א", description: "פעיל", parentProjectId: "parent-123" });
});

test("parseAssignmentSuggestions keeps only known files and projects", () => {
  const suggestions = parseAssignmentSuggestions('[{"fileId":"f1","projectId":"p1","reason":"שם דומה"},{"fileId":"bad","projectId":"p1"}]', new Set(["f1"]), new Set(["p1"]));
  assert.deepEqual(suggestions, [{ fileId: "f1", projectId: "p1", reason: "שם דומה" }]);
});

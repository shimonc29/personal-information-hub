# Projects and information hub design

## Product direction

Google Drive is the first information source, not a complete business-management system. The product organizes Drive safely, lets users search and question their information, and surfaces changes and useful findings.

The home page focuses on three areas: what is new, insights, and asking the information. AI suggestions remain reviewable and never change Drive without explicit approval.

## Project model

Users can create, edit, archive, and nest projects. The first interface supports two visible levels: projects and subprojects. Deleting a project never deletes Drive files. Its children move to the deleted project's parent, and its document links are removed.

A document can belong to several projects. Projects and assignments form a virtual organization layer; files remain in their original Drive locations.

## Delivery

Phase one adds project editing, safe removal, subprojects, and hierarchical display. Phase two replaces the current single-project link with a many-to-many document assignment table. Phase three adds change tracking, grounded insights, and source-backed questions. Applying the structure to Drive comes later and requires a preview, explicit approval, and undo.

## Safety and tests

Every request uses the signed-in user's token and existing row-level security. Validation prevents invalid names, circular parent links, and cross-user references. Tests cover creation, editing, removal, hierarchy, assignments, and API errors.

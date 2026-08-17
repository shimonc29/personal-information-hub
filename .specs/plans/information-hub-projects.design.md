# Projects and information hub design

## Product direction

Google Drive is the first information source, not a complete business-management system. The product organizes Drive safely, lets users search and question their information, and surfaces changes and useful findings.

The home page focuses on three areas: what is new, insights, and asking the information. AI suggestions remain reviewable and never change Drive without explicit approval.

## First-run flow

After connecting Drive, the user first sees a factual health overview: total items, folders, file types, and items that need classification. The app then offers three virtual structures: life areas, projects and clients, or document types. Saving a structure creates organization only inside the app. It never changes Drive.

Content analysis requires a separate, explicit consent screen. The screen identifies OpenAI and infrastructure providers as processors and explains the purpose. Optional contribution to aggregated analytics is a separate choice, off by default, and never required to use the product. The current release records consent but does not read or send document content; server-side content processing, retention, revocation, and deletion controls must exist before activation.

## Project model

Users can create, edit, archive, and nest projects. The first interface supports two visible levels: projects and subprojects. Deleting a project never deletes Drive files. Its children move to the deleted project's parent, and its document links are removed.

A document can belong to several projects. Projects and assignments form a virtual organization layer; files remain in their original Drive locations.

## Delivery

Phase one adds project editing, safe removal, subprojects, and hierarchical display. Phase two replaces the current single-project link with a many-to-many document assignment table. Phase three adds change tracking, grounded insights, and source-backed questions. Applying the structure to Drive comes later and requires a preview, explicit approval, and undo.

## Safety and tests

Every request uses the signed-in user's token and existing row-level security. Validation prevents invalid names, circular parent links, and cross-user references. Tests cover creation, editing, removal, hierarchy, assignments, and API errors.

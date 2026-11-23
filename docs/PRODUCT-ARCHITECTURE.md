# Redro Web Designer — Product & Engineering Architecture

**Status:** Architecture baseline  
**Product:** Redro Web Designer  
**Owner:** Redro  
**Initial browser targets:** Chrome and Firefox  
**Editor platform:** Desktop only; phone-sized editor layouts are out of scope

## 1. Product definition

Redro Web Designer is a visual website creation tool for people with no programming experience. It combines the freedom of a graphic-design canvas with website layout, responsive behavior, reusable components, and visual interaction logic.

The output must be a real website made of HTML, CSS, JavaScript, and assets—not a screenshot, static canvas image, or editor-only preview.

### Non-negotiable product principles

1. No-code authoring: normal users configure everything through visible controls, forms, menus, and visual logic blocks.
2. Freeform design: users can place and arrange elements freely while retaining access to structured layout tools.
3. Preview/export parity: the editor preview and exported website use the same document model and rendering rules.
4. Local-first: projects are stored locally and remain usable without an account or continuous internet connection, except for explicitly connected services.
5. Honest capability boundaries: accounts, remote databases, server-side workflows, email delivery, and other backend capabilities require a configured backend or external provider.
6. User-owned hosting: export files are independent of any specific hosting company.
7. PWA is optional per website project.
8. Initial compatibility and QA focus is Chrome and Firefox.

## 2. Initial scope

### Included in the foundation

- Editor shell and workspace navigation
- Project create, open, rename, duplicate, import, and export
- Multi-page document model
- Freeform canvas with viewport zoom and pan
- Element selection, multi-selection, move, resize, rotate, duplicate, delete
- Layers: reorder, hide, lock, group, ungroup
- Text, image, shape, button, container, and section elements
- Inspector that changes according to the selected element
- Typography, fill, border, radius, opacity, shadow, spacing, alignment, and sizing controls
- Desktop editor workspace; generated websites may use responsive layouts for visitor devices
- Undo/redo and autosave
- Export of a working static website
- Optional PWA packaging for exported sites
- Accessible keyboard interactions and clear empty/error states

### Planned after the foundation

- Visual interaction/logic editor
- Forms and validation flows
- Reusable components and design presets
- Data collections and integrations
- Authentication and account-connected features
- Backend workflow configuration
- Asset library and advanced image editing
- Collaboration and optional cloud synchronization
- Commercial activation and device management

These are product capabilities, not promises that a static exported site can perform server-side work without a backend.

### Explicitly out of initial scope

- Native Android/iOS application packaging
- A built-in hosting service
- Mandatory cloud accounts or cloud-only project storage
- User-authored source code as the primary workflow
- A claim that every backend feature works offline

## 3. Recommended architecture

### Application stack

- React + TypeScript + Vite for the editor application
- Zustand for predictable editor state and history coordination
- IndexedDB for project documents, thumbnails, and local assets
- SVG and HTML as the initial hybrid canvas representation
- CSS layout primitives for exported responsive pages
- Vitest for unit and integration tests
- Playwright for Chrome and Firefox end-to-end tests

Dependency versions must be selected and pinned during scaffold creation. Avoid adding libraries until a concrete requirement justifies them.

### Main modules

| Module | Responsibility |
|---|---|
| App Shell | Workspace, navigation, dialogs, notifications |
| Project Manager | Project lifecycle, import/export, recovery |
| Document Model | Canonical pages, nodes, styles, assets, breakpoints |
| Editor Store | Selection, viewport, tools, history, transient UI state |
| Canvas Renderer | Render document nodes in the editor |
| Interaction Controller | Pointer, keyboard, drag, resize, rotate, selection |
| Inspector | Context-sensitive property editing |
| Layer Manager | Ordering, visibility, locking, grouping |
| Responsive Engine | Breakpoint-aware layout and preview |
| Asset Manager | Image ingestion, metadata, references |
| Preview Runtime | Run the document using production rendering rules |
| Export Engine | Generate HTML, CSS, JS, and asset files |
| PWA Packager | Optional manifest, service worker, icons, offline policy |
| Visual Logic Engine | Future event/condition/action graph |
| Local Persistence | IndexedDB transactions, autosave, recovery |

Keep editor-only state out of the persisted website document. Selection, hover, active tool, zoom, and open panels must not leak into exported output.

## 4. Canonical document model

The document model is the single source of truth for the editor preview and export engine. Do not maintain a separate hand-built preview implementation and export implementation.

### Project

- id
- schemaVersion
- name
- createdAt
- updatedAt
- pages[]
- assets[]
- theme
- breakpoints
- exportSettings

### Page

- id
- name
- slug
- title
- description
- rootNodes[]
- pageSettings

### Node

Every visual element has a stable ID and a typed configuration.

- id
- type
- parentId
- children[]
- name
- layout
- style
- responsiveOverrides
- attributes
- interactions
- locked
- visible

Initial node types: page-section, container, text, image, shape, button. New types must be introduced through a versioned schema and tested renderer/exporter support.

### Layout and responsive behavior

Use explicit layout modes rather than assuming every element is absolutely positioned:

- Free positioning for graphic-like placement
- Flex layout for rows and columns
- Grid layout for structured responsive content
- Flow layout for text and content sections

Store breakpoint overrides as deltas from base properties. Define initial breakpoints centrally and make them configurable in a later milestone. Export CSS media queries from these same values.

### Style model

Use normalized typed properties: dimensions, spacing, colors, typography, borders, shadows, opacity, transforms, and backgrounds. Avoid arbitrary CSS text fields in the normal user interface.

### Schema evolution

- Every project has a schemaVersion.
- Migrations are deterministic and tested.
- Unknown node types must produce a visible recoverable warning, not silently delete content.
- Import must validate file structure, asset references, and schema compatibility.

## 5. Preview and export parity

This is a core architectural constraint.

1. Both preview and export consume the same canonical document model.
2. Both use shared style normalization, layout rules, breakpoints, and element semantics.
3. The preview runtime must not depend on editor selection overlays or editor-only CSS.
4. Export output must be independently runnable outside the editor.
5. Golden fixtures compare preview screenshots with exported-site screenshots at matching viewport sizes.
6. Interaction definitions must have the same meaning in preview and exported runtime.

The editor may display selection outlines, guides, handles, and measurement overlays, but these are editor chrome and must never appear in exported files.

## 6. Visual interaction engine — planned design

The visual logic editor will represent workflows as typed graphs rather than generated source text exposed to users.

### Core graph concepts

- Trigger: click, form submit, page load, value change
- Condition: equals, contains, is empty, numeric comparison, boolean checks
- Action: navigate, scroll, show/hide, set value, validate form, display message
- Variable: typed local state
- Flow control: branching and bounded iteration where safe and useful

### Execution boundaries

**Client-side:** navigation, visibility, local state, form validation, UI feedback, and browser-supported actions.

**Backend/provider required:** persistent shared data, secure authentication, private secrets, email/SMS delivery, payment processing, and privileged operations.

The visual editor must identify when a selected capability requires a backend or provider configuration. Never embed secret API keys in exported browser code.

## 7. Local persistence and project portability

- IndexedDB is the primary local project store.
- Autosave must be debounced and transactional.
- Maintain a recoverable last-known-good document snapshot.
- Project export must include the document and referenced assets in a portable package.
- Project import must validate before replacing or creating a project.
- Provide clear storage quota and recovery errors.
- Local projects must not be deleted when a user signs out or loses network access.

Cloud sync is optional future scope and must not be a prerequisite for opening locally stored projects.

## 8. Export format

A normal website export contains, as required:

- HTML pages
- CSS stylesheets
- JavaScript runtime for configured interactions
- Asset files
- A clear entry page and relative asset paths

PWA export is optional and adds:

- manifest.webmanifest
- service-worker.js
- icon assets
- A configurable offline caching strategy

PWA installation generally requires HTTPS or localhost. The export UI must explain this requirement. Do not label a PWA as a native mobile application.

Hosting is outside this product's responsibility. The user receives portable files and chooses where to publish them.

## 9. Account, activation, and commercial model

The planned commercial model is a one-time lifetime license, not a recurring subscription.

- License belongs to the user's account, not permanently to one computer.
- A user should remain signed in between sessions unless they sign out or revoke the session.
- Local editing and project access should not be blocked by a mandatory sign-in.
- Activation and license recovery require a secure service; they cannot be implemented securely as a client-only flag.
- Design for offline operation after successful activation, with a documented and proportionate revalidation policy.
- Device replacement must support license recovery without requiring a second purchase.
- Never delete local projects as a consequence of license or account errors.

Commercial tiers and update entitlements are product policy and must be explicitly defined before implementation.

## 10. Support

Provide an in-app Help & Support area with issue categories:

- Application bug
- Design issue
- Website export issue
- Save/recovery issue
- Feature suggestion
- Other

Name is optional. Additional notes are optional except when the user selects Other. Offer Telegram and WhatsApp as handoff destinations once official Redro contact details are supplied. Prepare a structured message; opening an external app does not mean the message was sent.

## 11. Security and reliability

- Treat imported project files and image metadata as untrusted input.
- Sanitize user-provided text and URLs before export.
- Do not permit javascript: URLs or unsafe HTML injection through normal properties.
- Keep secrets out of browser bundles and exported sites.
- Validate asset MIME types and enforce reasonable size limits.
- Make project migrations and imports recoverable.
- Avoid destructive operations without confirmation and undo support.
- Use stable IDs and deterministic export output.

## 12. Milestones

### M0 — Repository foundation
- Establish the application scaffold and pinned dependencies.
- Add linting, type checking, unit tests, and build checks.
- Add architecture and contribution documentation.

### M1 — Document and project core
- Implement versioned document schema.
- Implement IndexedDB project storage.
- Implement create/open/rename/duplicate/import/export.
- Test migrations and recovery.

### M2 — Visual editor foundation
- Implement workspace shell, canvas, viewport, selection, transform, and keyboard controls.
- Implement layers and grouping.
- Implement inspector for initial node types.

### M3 — Layout and responsive editing
- Implement free, flex, and grid layout modes.
- Implement responsive overrides and viewport previews for the websites being authored.
- Keep the editor application itself desktop-only.
- Test generated website layouts at representative desktop, tablet, and phone widths.

### M4 — Shared preview and export
- Implement shared rendering primitives.
- Generate portable HTML/CSS/JS output.
- Verify exported sites in Chrome and Firefox.
- Add screenshot parity fixtures.

### M5 — Visual interactions
- Implement typed event/condition/action graphs.
- Implement client-side runtime.
- Add clear backend-required capability boundaries.

### M6 — PWA and product readiness
- Add optional PWA packaging.
- Add support handoff UI.
- Conduct accessibility, performance, security, and recovery testing.

### Later — Accounts and licensing
- Design and implement the license service, account sessions, device management, and offline activation policy.
- Do not make this a blocker for the local-first editor foundation.

## 13. Acceptance criteria

A milestone is not complete because a screen looks convincing. It is complete only when its behavior is tested.

### Project and document
- A project can be created, saved, closed, and reopened without losing content.
- Autosave survives a reload and interrupted session.
- Import rejects malformed packages without damaging existing projects.
- Undo/redo restores document state accurately.

### Editing
- Elements can be created, selected, moved, resized, duplicated, and deleted.
- Multi-selection, grouping, locking, hiding, and layer ordering behave consistently.
- Inspector changes update only the intended selected element.
- Keyboard and pointer interactions do not conflict.

### Responsive
- Generated website breakpoint overrides remain independent where configured.
- Changing one breakpoint does not unintentionally corrupt another.
- Preview dimensions match the selected viewport.

### Export
- Exported files open as a real website in Chrome and Firefox.
- Images and other assets resolve using portable relative paths.
- Preview and export match for the same document and viewport within defined screenshot tolerances.
- Editor-only controls never appear in the exported site.
- Optional PWA output has a valid manifest and service worker and follows browser installation requirements.

### Reliability
- No uncaught errors during core editor workflows.
- Large documents do not trigger unbounded render loops.
- Storage failures are surfaced with recovery guidance.
- All critical workflows have automated tests.

## 14. Initial quality gates

Every implementation milestone must pass:

1. TypeScript type check
2. Lint
3. Unit and integration tests
4. Production build
5. Playwright smoke tests in Chrome and Firefox for user-facing flows
6. Manual review of keyboard behavior, mobile viewport handling, and recovery paths where automation is insufficient

No claim of passing a test may be made unless the test was actually run and its result recorded.

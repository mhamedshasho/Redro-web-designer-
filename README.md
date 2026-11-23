# Redro Web Designer

**Design Anything. No Code Required.**

Redro Web Designer is a visual, no-code website authoring environment. Users create real, responsive websites through a freeform visual editor, element properties, reusable components, and visual interaction logic. The editor generates production-ready web files behind the scenes.

## Product principles

- Visual-first authoring: users should not need to write HTML, CSS, or JavaScript.
- Freeform canvas with precise positioning, alignment, layers, grouping, and responsive layouts.
- One document model powers both the editor preview and exported website.
- Local-first project storage with explicit project export and import.
- Clear separation between browser-only interactions and features requiring a backend or external provider.
- Export real website files; hosting remains the user's choice.
- Optional PWA output, not forced on every project.
- Chrome and Firefox are the initial supported browsers. The editor workspace is desktop-only; phone-sized editor layouts are intentionally out of scope.

## Current status

The repository now contains an early React/TypeScript editor foundation with local IndexedDB persistence, canvas element selection, rectangle, ellipse, triangle, diamond, pentagon, star, line, and arrow shape variants with editable shape type and corner radius, text insertion, pointer-based movement and resizing, direct rotation, multi-selection, layer visibility and locking, typography controls for font family/weight/style/decoration/line-height/letter-spacing, image Cover crop focal positioning, a recursive per-page image asset panel with direct selection and in-place image replacement, color/appearance controls, 8px snap grid, multi-element alignment, layer stacking controls, page-level Free/Flexbox/Grid/Flow layouts with gap/padding/alignment controls, basic container creation/grouping/ungrouping with nested child rendering, a recursive expandable layer tree, nested sibling reordering, deep duplication with regenerated child IDs, inherited container locking, creating new elements directly inside a selected container (including nested containers), multi-selection from the layer tree with Shift-click, moving selected elements into another container while preserving their absolute canvas position when the page and source/target ancestor layouts use Free positioning, cycle and locked-ancestor prevention for reparenting, per-container Free/Flexbox/Grid/Flow layout controls, configurable container direction/gap/padding/columns/alignment, inspector controls, and keyboard undo/redo. The editor is desktop-only.

This is still an early editor prototype. Responsive breakpoint layouts, drag-and-drop reparenting between existing containers and reparenting across Flex/Grid ancestor layouts, pixel-accurate destructive crop editing, a deduplicated binary asset library, reusable components, multi-page editing, responsive breakpoint layouts, and production website export are not implemented yet. Image insertion currently supports PNG, JPEG, WebP, and GIF files up to 8 MB each; image data is stored inside the local project record in IndexedDB, with Contain/Cover/Stretch fitting, adjustable horizontal/vertical crop focal position, standard canvas resizing, and an asset panel listing image elements on the active page with selection and in-place replacement. Each image element currently stores its own data URL; shared binary deduplication is not implemented. Container nesting can be built by selecting a container and adding another container inside it; grouping an already-populated container remains restricted. Build and test commands are defined, but must be run in a local development environment before this prototype is treated as verified.

See [Product and Engineering Architecture](docs/PRODUCT-ARCHITECTURE.md) for scope, system design, data model, milestones, and acceptance criteria.

## Planned initial stack

- React + TypeScript + Vite
- SVG/HTML hybrid canvas
- Zustand for editor state
- IndexedDB for local projects and assets
- Shared document renderer for preview and export
- Vitest and Playwright for automated tests

Run the local checks with:

```bash
npm install
npm run typecheck
npm test
npm run build
```

These checks have not yet been executed in the current development session.

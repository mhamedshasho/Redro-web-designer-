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

The repository now contains an early React/TypeScript editor foundation with local IndexedDB persistence, canvas element selection, rectangle and text insertion, pointer-based movement and resizing, direct rotation, multi-selection, layer visibility and locking, typography/color/appearance controls, 8px snap grid, multi-element alignment, layer stacking controls, page-level Free/Flexbox/Grid/Flow layouts with gap/padding/alignment controls, basic container creation/grouping/ungrouping with nested child rendering, a recursive expandable layer tree, nested sibling reordering, deep duplication with regenerated child IDs, inherited container locking, creating new elements directly inside a selected container (including nested containers), multi-selection from the layer tree with Shift-click, moving selected elements into another container while preserving their absolute canvas position, cycle and locked-ancestor prevention for reparenting, per-container Free/Flexbox/Grid/Flow layout controls, configurable container direction/gap/padding/columns/alignment, inspector controls, and keyboard undo/redo. The editor is desktop-only.

This is still an early editor prototype. Responsive breakpoint layouts, drag-and-drop reparenting between existing containers, image assets, reusable components, multi-page editing, responsive breakpoint layouts, and production website export are not implemented yet. Container nesting can be built by selecting a container and adding another container inside it; grouping an already-populated container remains restricted. Build and test commands are defined, but must be run in a local development environment before this prototype is treated as verified.

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

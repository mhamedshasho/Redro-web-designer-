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
- Chrome and Firefox are the initial supported browsers.

## Current status

The repository now contains an early React/TypeScript editor foundation with local IndexedDB persistence, canvas element selection, pointer-based movement and resizing, direct rotation, multi-selection, layer visibility and locking, inspector controls, and keyboard undo/redo.

This is still an early editor prototype. Responsive breakpoint layouts, grouping, alignment guides, image assets, reusable components, multi-page editing, and production website export are not implemented yet. Build and test commands are defined, but must be run in a local development environment before this prototype is treated as verified.

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

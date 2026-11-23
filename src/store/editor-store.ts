import { create } from "zustand";
import {
  createProject,
  createTextNode,
  type DocumentNode,
  type WebsiteProject,
} from "../model/document";
import { listProjects, saveProject } from "../storage/project-storage";

interface EditorState {
  project: WebsiteProject;
  selectedNodeIds: string[];
  zoom: number;
  isReady: boolean;
  storageError: string | null;
  historyPast: WebsiteProject[];
  historyFuture: WebsiteProject[];
  initialize: () => Promise<void>;
  addText: () => void;
  selectNode: (id: string | null, additive?: boolean) => void;
  updateNodeText: (id: string, text: string) => void;
  updateNodeLayout: (id: string, patch: Partial<DocumentNode["layout"]>) => void;
  updateNodeStyle: (id: string, patch: Partial<DocumentNode["style"]>) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  resizeNode: (id: string, width: number, height: number) => void;
  rotateNode: (id: string, rotation: number) => void;
  toggleNodeVisibility: (id: string) => void;
  toggleNodeLock: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
}

let initializationPromise: Promise<void> | null = null;
const HISTORY_LIMIT = 80;

function currentNodes(project: WebsiteProject): DocumentNode[] {
  return project.pages[0]?.nodes ?? [];
}

function updateFirstPage(project: WebsiteProject, update: (nodes: DocumentNode[]) => DocumentNode[]): WebsiteProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    pages: project.pages.map((page, index) => index === 0 ? { ...page, nodes: update(page.nodes) } : page),
  };
}

function pushHistory(state: EditorState): Partial<EditorState> {
  return {
    historyPast: [...state.historyPast, state.project].slice(-HISTORY_LIMIT),
    historyFuture: [],
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createProject(),
  selectedNodeIds: [],
  zoom: 1,
  isReady: false,
  storageError: null,
  historyPast: [],
  historyFuture: [],
  initialize: () => {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      try {
        const projects = await listProjects();
        const project = projects[0] ?? createProject();
        if (projects.length === 0) await saveProject(project);
        set({ project, isReady: true, storageError: null });
      } catch (error) {
        initializationPromise = null;
        set({
          isReady: true,
          storageError: error instanceof Error ? error.message : "Local project storage is unavailable.",
        });
      }
    })();
    return initializationPromise;
  },
  addText: () => set((state) => {
    const count = currentNodes(state.project).length;
    const node = createTextNode(80 + count * 18, 80 + count * 18);
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => [...nodes, node]),
      selectedNodeIds: [node.id],
    };
  }),
  selectNode: (id, additive = false) => set((state) => {
    if (!id) return { selectedNodeIds: [] };
    if (!additive) return { selectedNodeIds: [id] };
    const exists = state.selectedNodeIds.includes(id);
    return { selectedNodeIds: exists ? state.selectedNodeIds.filter((item) => item !== id) : [...state.selectedNodeIds, id] };
  }),
  updateNodeText: (id, text) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id ? { ...node, text } : node)),
  })),
  updateNodeLayout: (id, patch) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id ? { ...node, layout: { ...node.layout, ...patch } } : node)),
  })),
  updateNodeStyle: (id, patch) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id ? { ...node, style: { ...node.style, ...patch } } : node)),
  })),
  moveNodes: (ids, dx, dy) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => ids.includes(node.id) && !node.locked
      ? { ...node, layout: { ...node.layout, x: Math.max(0, node.layout.x + dx), y: Math.max(0, node.layout.y + dy) } }
      : node)),
  })),
  resizeNode: (id, width, height) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id && !node.locked
      ? { ...node, layout: { ...node.layout, width: Math.max(24, width), height: Math.max(24, height) } }
      : node)),
  })),
  toggleNodeVisibility: (id) => set((state) => ({
    ...pushHistory(state),
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id ? { ...node, visible: !node.visible } : node)),
  })),
  toggleNodeLock: (id) => set((state) => ({
    ...pushHistory(state),
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id ? { ...node, locked: !node.locked } : node)),
  })),
  rotateNode: (id, rotation) => set((state) => ({
    ...pushHistory(state),
    project: updateFirstPage(state.project, (nodes) => nodes.map((node) => node.id === id
      ? { ...node, layout: { ...node.layout, rotation } }
      : node)),
  })),
  deleteSelected: () => set((state) => {
    if (state.selectedNodeIds.length === 0) return {};
    const ids = state.selectedNodeIds;
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => nodes.filter((node) => !ids.includes(node.id))),
      selectedNodeIds: [],
    };
  }),
  duplicateSelected: () => set((state) => {
    const selected = currentNodes(state.project).filter((node) => state.selectedNodeIds.includes(node.id));
    if (!selected.length) return {};
    const copies = selected.map((node) => ({
      ...node,
      id: crypto.randomUUID(),
      name: `${node.name} copy`,
      layout: { ...node.layout, x: node.layout.x + 24, y: node.layout.y + 24 },
    }));
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => [...nodes, ...copies]),
      selectedNodeIds: copies.map((node) => node.id),
    };
  }),
  commitHistory: () => set((state) => pushHistory(state)),
  undo: () => set((state) => {
    if (!state.historyPast.length) return {};
    const previous = state.historyPast[state.historyPast.length - 1];
    return {
      project: previous,
      historyPast: state.historyPast.slice(0, -1),
      historyFuture: [state.project, ...state.historyFuture].slice(0, HISTORY_LIMIT),
      selectedNodeIds: [],
    };
  }),
  redo: () => set((state) => {
    if (!state.historyFuture.length) return {};
    const next = state.historyFuture[0];
    return {
      project: next,
      historyPast: [...state.historyPast, state.project].slice(-HISTORY_LIMIT),
      historyFuture: state.historyFuture.slice(1),
      selectedNodeIds: [],
    };
  }),
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),
}));

import { create } from "zustand";
import {
  createProject,
  createTextNode,
  createShapeNode,
  createContainerNode,
  type DocumentNode,
  type WebsiteProject,
  type PageLayout,
} from "../model/document";
import { listProjects, saveProject } from "../storage/project-storage";

interface EditorState {
  project: WebsiteProject;
  selectedNodeIds: string[];
  zoom: number;
  snapEnabled: boolean;
  isReady: boolean;
  storageError: string | null;
  historyPast: WebsiteProject[];
  historyFuture: WebsiteProject[];
  initialize: () => Promise<void>;
  addText: () => void;
  addShape: () => void;
  addContainer: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  selectNode: (id: string | null, additive?: boolean) => void;
  updateNodeText: (id: string, text: string) => void;
  updateNodeLayout: (id: string, patch: Partial<DocumentNode["layout"]>) => void;
  updateNodeStyle: (id: string, patch: Partial<DocumentNode["style"]>) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  snapSelectedToGrid: () => void;
  alignSelected: (axis: "left" | "center-x" | "right" | "top" | "center-y" | "bottom") => void;
  resizeNode: (id: string, width: number, height: number) => void;
  rotateNode: (id: string, rotation: number) => void;
  toggleNodeVisibility: (id: string) => void;
  toggleNodeLock: (id: string) => void;
  moveLayer: (id: string, direction: "forward" | "backward") => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
  updatePageLayout: (patch: Partial<PageLayout>) => void;
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

function mapNodeTree(nodes: DocumentNode[], id: string, update: (node: DocumentNode) => DocumentNode): DocumentNode[] {
  return nodes.map((node) => {
    if (node.id === id) return update(node);
    if (node.children.length) return { ...node, children: mapNodeTree(node.children, id, update) };
    return node;
  });
}

function mapManyNodeTree(nodes: DocumentNode[], ids: string[], update: (node: DocumentNode) => DocumentNode): DocumentNode[] {
  return nodes.map((node) => {
    if (ids.includes(node.id)) return update(node);
    if (node.children.length) return { ...node, children: mapManyNodeTree(node.children, ids, update) };
    return node;
  });
}

function pushHistory(state: EditorState): Partial<EditorState> {
  return {
    historyPast: [...state.historyPast, state.project].slice(-HISTORY_LIMIT),
    historyFuture: [],
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  project: createProject(),
  selectedNodeIds: [],
  zoom: 1,
  snapEnabled: true,
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
  addShape: () => set((state) => {
    const count = currentNodes(state.project).length;
    const node = createShapeNode(120 + count * 18, 120 + count * 18);
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => [...nodes, node]),
      selectedNodeIds: [node.id],
    };
  }),
  addContainer: () => set((state) => {
    const node = createContainerNode();
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => [...nodes, node]),
      selectedNodeIds: [node.id],
    };
  }),
  groupSelected: () => set((state) => {
    const nodes = currentNodes(state.project);
    const selected = nodes.filter((node) => state.selectedNodeIds.includes(node.id));
    if (selected.length < 2 || selected.some((node) => node.type === "container" && node.children.length)) return {};
    const left = Math.min(...selected.map((node) => node.layout.x));
    const top = Math.min(...selected.map((node) => node.layout.y));
    const right = Math.max(...selected.map((node) => node.layout.x + node.layout.width));
    const bottom = Math.max(...selected.map((node) => node.layout.y + node.layout.height));
    const container = createContainerNode();
    container.name = "Group";
    container.layout = { ...container.layout, x: left, y: top, width: Math.max(80, right - left), height: Math.max(60, bottom - top) };
    container.children = selected.map((node) => ({
      ...node,
      layout: { ...node.layout, x: node.layout.x - left, y: node.layout.y - top },
    }));
    const selectedIds = new Set(selected.map((node) => node.id));
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (items) => [...items.filter((node) => !selectedIds.has(node.id)), container]),
      selectedNodeIds: [container.id],
    };
  }),
  ungroupSelected: () => set((state) => {
    const nodes = currentNodes(state.project);
    const container = nodes.find((node) => state.selectedNodeIds.includes(node.id) && node.type === "container");
    if (!container || container.children.length === 0) return {};
    const restored = container.children.map((child) => ({
      ...child,
      layout: { ...child.layout, x: child.layout.x + container.layout.x, y: child.layout.y + container.layout.y },
    }));
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (items) => [...items.filter((node) => node.id !== container.id), ...restored]),
      selectedNodeIds: restored.map((node) => node.id),
    };
  }),
  selectNode: (id, additive = false) => set((state) => {
    if (!id) return { selectedNodeIds: [] };
    if (!additive) return { selectedNodeIds: [id] };
    const exists = state.selectedNodeIds.includes(id);
    return { selectedNodeIds: exists ? state.selectedNodeIds.filter((item) => item !== id) : [...state.selectedNodeIds, id] };
  }),
  updateNodeText: (id, text) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => ({ ...node, text }))),
  })),
  updateNodeLayout: (id, patch) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => ({ ...node, layout: { ...node.layout, ...patch } }))),
  })),
  updateNodeStyle: (id, patch) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => ({ ...node, style: { ...node.style, ...patch } }))),
  })),
  moveNodes: (ids, dx, dy) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => mapManyNodeTree(nodes, ids, (node) => !node.locked
      ? { ...node, layout: { ...node.layout, x: Math.max(0, node.layout.x + dx), y: Math.max(0, node.layout.y + dy) } }
      : node)),
  })),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  snapSelectedToGrid: () => set((state) => {
    const ids = state.selectedNodeIds;
    if (!ids.length) return {};
    return {
      project: updateFirstPage(state.project, (nodes) => nodes.map((node) => ids.includes(node.id) && !node.locked
        ? { ...node, layout: { ...node.layout, x: Math.round(node.layout.x / 8) * 8, y: Math.round(node.layout.y / 8) * 8 } }
        : node)),
    };
  }),
  alignSelected: (axis) => set((state) => {
    const selected = currentNodes(state.project).filter((node) => state.selectedNodeIds.includes(node.id) && !node.locked);
    if (selected.length < 2) return {};
    const left = Math.min(...selected.map((node) => node.layout.x));
    const top = Math.min(...selected.map((node) => node.layout.y));
    const right = Math.max(...selected.map((node) => node.layout.x + node.layout.width));
    const bottom = Math.max(...selected.map((node) => node.layout.y + node.layout.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => nodes.map((node) => {
        if (!state.selectedNodeIds.includes(node.id) || node.locked) return node;
        let x = node.layout.x;
        let y = node.layout.y;
        if (axis === "left") x = left;
        if (axis === "center-x") x = centerX - node.layout.width / 2;
        if (axis === "right") x = right - node.layout.width;
        if (axis === "top") y = top;
        if (axis === "center-y") y = centerY - node.layout.height / 2;
        if (axis === "bottom") y = bottom - node.layout.height;
        return { ...node, layout: { ...node.layout, x, y } };
      })),
    };
  }),
  resizeNode: (id, width, height) => set((state) => ({
    project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => !node.locked
      ? { ...node, layout: { ...node.layout, width: Math.max(24, width), height: Math.max(24, height) } }
      : node)),
  })),
  toggleNodeVisibility: (id) => set((state) => ({
    ...pushHistory(state),
    project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => ({ ...node, visible: !node.visible }))),
  })),
  toggleNodeLock: (id) => set((state) => ({
    ...pushHistory(state),
    project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => ({ ...node, locked: !node.locked }))),
  })),
  moveLayer: (id, direction) => set((state) => {
    const nodes = currentNodes(state.project);
    const index = nodes.findIndex((node) => node.id === id);
    const target = direction === "forward" ? index + 1 : index - 1;
    if (index < 0 || target < 0 || target >= nodes.length) return {};
    const reordered = [...nodes];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => reordered),
    };
  }),
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
  updatePageLayout: (patch) => set((state) => ({
    project: {
      ...state.project,
      updatedAt: new Date().toISOString(),
      pages: state.project.pages.map((page, index) => index === 0
        ? {
            ...page,
            layout: {
              mode: "free",
              direction: "row",
              gap: 16,
              padding: 24,
              columns: 3,
              justifyContent: "start",
              alignItems: "start",
              ...page.layout,
              ...patch,
            },
          }
        : page),
    },
  })),
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),
}));

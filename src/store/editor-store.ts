import { create } from "zustand";
import {
  createProject,
  createTextNode,
  createShapeNode,
  createContainerNode,
  createImageNode,
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
  addImage: (src: string, name?: string) => void;
  replaceImage: (id: string, src: string, name?: string) => void;
  groupSelected: () => void;
  moveSelectedIntoContainer: (containerId: string) => void;
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

function removeNodeTree(nodes: DocumentNode[], ids: string[]): DocumentNode[] {
  return nodes
    .filter((node) => !ids.includes(node.id))
    .map((node) => node.children.length ? { ...node, children: removeNodeTree(node.children, ids) } : node);
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

function reorderNodeTree(nodes: DocumentNode[], id: string, direction: "forward" | "backward"): { nodes: DocumentNode[]; changed: boolean } {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const target = direction === "forward" ? index + 1 : index - 1;
    if (target < 0 || target >= nodes.length) return { nodes, changed: false };
    const reordered = [...nodes];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    return { nodes: reordered, changed: true };
  }
  for (let i = 0; i < nodes.length; i += 1) {
    if (!nodes[i]!.children.length) continue;
    const nested = reorderNodeTree(nodes[i]!.children, id, direction);
    if (nested.changed) return {
      nodes: nodes.map((node, nodeIndex) => nodeIndex === i ? { ...node, children: nested.nodes } : node),
      changed: true,
    };
  }
  return { nodes, changed: false };
}

function cloneNodeTree(node: DocumentNode, offset = 24): DocumentNode {
  return {
    ...node,
    id: crypto.randomUUID(),
    name: node.name.endsWith(" copy") ? node.name : `${node.name} copy`,
    layout: { ...node.layout, x: node.layout.x + offset, y: node.layout.y + offset },
    children: node.children.map((child) => cloneNodeTree(child, 0)),
  };
}

function findNodeTree(nodes: DocumentNode[], id: string): DocumentNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNodeTree(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

function isEffectivelyLocked(nodes: DocumentNode[], id: string, inherited = false): boolean {
  for (const node of nodes) {
    const locked = inherited || node.locked;
    if (node.id === id) return locked;
    if (isEffectivelyLocked(node.children, id, locked)) return true;
  }
  return false;
}

function duplicateAsSibling(nodes: DocumentNode[], id: string, copies: DocumentNode[]): { nodes: DocumentNode[]; inserted: boolean } {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const next = [...nodes];
    next.splice(index + 1, 0, ...copies);
    return { nodes: next, inserted: true };
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const nested = duplicateAsSibling(nodes[i]!.children, id, copies);
    if (nested.inserted) return {
      nodes: nodes.map((node, nodeIndex) => nodeIndex === i ? { ...node, children: nested.nodes } : node),
      inserted: true,
    };
  }
  return { nodes, inserted: false };
}


function appendToContainer(nodes: DocumentNode[], containerId: string, child: DocumentNode): { nodes: DocumentNode[]; inserted: boolean } {
  let inserted = false;
  const next = nodes.map((node) => {
    if (node.id === containerId && node.type === "container" && !node.locked) {
      inserted = true;
      return { ...node, children: [...node.children, child] };
    }
    if (!inserted && node.children.length) {
      const nested = appendToContainer(node.children, containerId, child);
      if (nested.inserted) {
        inserted = true;
        return { ...node, children: nested.nodes };
      }
    }
    return node;
  });
  return { nodes: next, inserted };
}

function absoluteOrigin(nodes: DocumentNode[], id: string, parentX = 0, parentY = 0): { x: number; y: number } | undefined {
  for (const node of nodes) {
    const x = parentX + node.layout.x;
    const y = parentY + node.layout.y;
    if (node.id === id) return { x, y };
    const nested = absoluteOrigin(node.children, id, x, y);
    if (nested) return nested;
  }
  return undefined;
}

function isDescendant(nodes: DocumentNode[], ancestorId: string, candidateId: string): boolean {
  const ancestor = findNodeTree(nodes, ancestorId);
  return Boolean(ancestor && findNodeTree(ancestor.children, candidateId));
}

function ancestorsUseFreeLayout(nodes: DocumentNode[], id: string, parentIsFree = true): boolean | undefined {
  for (const node of nodes) {
    if (node.id === id) return parentIsFree;
    const nested = ancestorsUseFreeLayout(node.children, id, parentIsFree && node.layout.mode === "free");
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function hasLockedAncestor(nodes: DocumentNode[], id: string, inheritedLocked = false): boolean {
  for (const node of nodes) {
    const locked = inheritedLocked || node.locked;
    if (node.id === id) return locked;
    if (hasLockedAncestor(node.children, id, locked)) return true;
  }
  return false;
}

function selectedContainer(state: EditorState): DocumentNode | undefined {
  if (state.selectedNodeIds.length !== 1) return undefined;
  const node = findNodeTree(currentNodes(state.project), state.selectedNodeIds[0]!);
  return node?.type === "container" && !node.locked ? node : undefined;
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
    const parent = selectedContainer(state);
    const offset = parent ? 24 + parent.children.length * 12 : 80 + count * 18;
    const node = createTextNode(offset, offset);
    const updated = parent
      ? appendToContainer(currentNodes(state.project), parent.id, node)
      : { nodes: [...currentNodes(state.project), node], inserted: true };
    if (!updated.inserted) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => updated.nodes),
      selectedNodeIds: [node.id],
    };
  }),
  addShape: () => set((state) => {
    const count = currentNodes(state.project).length;
    const parent = selectedContainer(state);
    const offset = parent ? 24 + parent.children.length * 12 : 120 + count * 18;
    const node = createShapeNode(offset, offset);
    const updated = parent
      ? appendToContainer(currentNodes(state.project), parent.id, node)
      : { nodes: [...currentNodes(state.project), node], inserted: true };
    if (!updated.inserted) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => updated.nodes),
      selectedNodeIds: [node.id],
    };
  }),
  addImage: (src, name = "Image") => set((state) => {
    if (!src.startsWith("data:image/")) return {};
    const roots = currentNodes(state.project);
    const parent = selectedContainer(state);
    const offset = parent ? 24 + parent.children.length * 12 : 160 + roots.length * 14;
    const node = createImageNode(src, offset, offset);
    node.name = name.slice(0, 120) || "Image";
    const updated = parent
      ? appendToContainer(roots, parent.id, node)
      : { nodes: [...roots, node], inserted: true };
    if (!updated.inserted) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => updated.nodes),
      selectedNodeIds: [node.id],
    };
  }),
  replaceImage: (id, src, name) => set((state) => {
    if (!src.startsWith("data:image/")) return {};
    const target = findNodeTree(currentNodes(state.project), id);
    if (!target || target.type !== "image" || isEffectivelyLocked(currentNodes(state.project), id)) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, (nodes) => mapNodeTree(nodes, id, (node) => ({
        ...node,
        text: src,
        name: name?.slice(0, 120) || node.name,
      }))),
      selectedNodeIds: [id],
    };
  }),
  addContainer: () => set((state) => {
    const parent = selectedContainer(state);
    const node = createContainerNode();
    if (parent) node.layout = { ...node.layout, x: 24 + parent.children.length * 12, y: 24 + parent.children.length * 12 };
    const updated = parent
      ? appendToContainer(currentNodes(state.project), parent.id, node)
      : { nodes: [...currentNodes(state.project), node], inserted: true };
    if (!updated.inserted) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => updated.nodes),
      selectedNodeIds: [node.id],
    };
  }),
  moveSelectedIntoContainer: (containerId) => set((state) => {
    const roots = currentNodes(state.project);
    const target = findNodeTree(roots, containerId);
    if (!target || target.type !== "container" || hasLockedAncestor(roots, containerId) || state.project.pages[0]?.layout.mode !== "free" || ancestorsUseFreeLayout(roots, containerId) !== true) return {};
    const selected = state.selectedNodeIds.filter((id) => id !== containerId);
    if (!selected.length || selected.some((id) => !findNodeTree(roots, id) || isDescendant(roots, id, containerId) || hasLockedAncestor(roots, id) || ancestorsUseFreeLayout(roots, id) !== true)) return {};
    const topLevelIds = selected.filter((id) => !selected.some((other) => other !== id && isDescendant(roots, other, id)));
    const targetOrigin = absoluteOrigin(roots, containerId);
    if (!targetOrigin) return {};
    const moving = topLevelIds.map((id) => {
      const node = findNodeTree(roots, id)!;
      const origin = absoluteOrigin(roots, id)!;
      return { ...node, layout: { ...node.layout, x: origin.x - targetOrigin.x, y: origin.y - targetOrigin.y } };
    });
    let nextNodes = removeNodeTree(roots, topLevelIds);
    const inserted = appendToContainer(nextNodes, containerId, moving[0]!);
    if (!inserted.inserted) return {};
    nextNodes = inserted.nodes;
    for (const node of moving.slice(1)) {
      const result = appendToContainer(nextNodes, containerId, node);
      if (!result.inserted) return {};
      nextNodes = result.nodes;
    }
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => nextNodes),
      selectedNodeIds: topLevelIds,
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
    const reordered = reorderNodeTree(currentNodes(state.project), id, direction);
    if (!reordered.changed) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => reordered.nodes),
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
      project: updateFirstPage(state.project, (nodes) => removeNodeTree(nodes, ids)),
      selectedNodeIds: [],
    };
  }),
  duplicateSelected: () => set((state) => {
    const roots = currentNodes(state.project);
    const selected = state.selectedNodeIds.map((id) => findNodeTree(roots, id)).filter((node): node is DocumentNode => Boolean(node));
    if (!selected.length) return {};
    let nextNodes = roots;
    const newIds: string[] = [];
    for (const node of selected) {
      const copy = cloneNodeTree(node);
      const inserted = duplicateAsSibling(nextNodes, node.id, [copy]);
      if (inserted.inserted) {
        nextNodes = inserted.nodes;
        newIds.push(copy.id);
      }
    }
    if (!newIds.length) return {};
    return {
      ...pushHistory(state),
      project: updateFirstPage(state.project, () => nextNodes),
      selectedNodeIds: newIds,
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

import { create } from "zustand";
import {
  createProject,
  createTextNode,
  type DocumentNode,
  type WebsiteProject,
} from "../model/document";

interface EditorState {
  project: WebsiteProject;
  selectedNodeId: string | null;
  zoom: number;
  addText: () => void;
  selectNode: (id: string | null) => void;
  updateNodeText: (id: string, text: string) => void;
  setZoom: (zoom: number) => void;
}

function currentNodes(project: WebsiteProject): DocumentNode[] {
  return project.pages[0]?.nodes ?? [];
}

export const useEditorStore = create<EditorState>((set) => ({
  project: createProject(),
  selectedNodeId: null,
  zoom: 1,
  addText: () =>
    set((state) => {
      const node = createTextNode(80 + currentNodes(state.project).length * 18, 80 + currentNodes(state.project).length * 18);
      const pages = state.project.pages.map((page, index) =>
        index === 0 ? { ...page, nodes: [...page.nodes, node] } : page,
      );

      return {
        project: { ...state.project, pages, updatedAt: new Date().toISOString() },
        selectedNodeId: node.id,
      };
    }),
  selectNode: (id) => set({ selectedNodeId: id }),
  updateNodeText: (id, text) =>
    set((state) => ({
      project: {
        ...state.project,
        updatedAt: new Date().toISOString(),
        pages: state.project.pages.map((page) => ({
          ...page,
          nodes: page.nodes.map((node) => node.id === id ? { ...node, text } : node),
        })),
      },
    })),
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),
}));

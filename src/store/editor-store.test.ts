import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../model/document";
import { useEditorStore } from "./editor-store";

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createProject("Editor test"),
      selectedNodeIds: [],
      historyPast: [],
      historyFuture: [],
      zoom: 1,
      isReady: true,
      storageError: null,
    });
  });

  it("adds and selects a text node", () => {
    useEditorStore.getState().addText();

    const state = useEditorStore.getState();
    expect(state.project.pages[0]?.nodes).toHaveLength(1);
    expect(state.selectedNodeIds).toHaveLength(1);
  });

  it("moves selected nodes and can undo and redo the movement", () => {
    useEditorStore.getState().addText();
    const node = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    const beforeX = node.layout.x;

    useEditorStore.getState().commitHistory();
    useEditorStore.getState().moveNodes([node.id], 40, 25);
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.layout.x).toBe(beforeX + 40);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.layout.x).toBe(beforeX);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.layout.x).toBe(beforeX + 40);
  });

  it("duplicates and deletes selected elements", () => {
    useEditorStore.getState().addText();
    useEditorStore.getState().duplicateSelected();
    expect(useEditorStore.getState().project.pages[0]?.nodes).toHaveLength(2);

    useEditorStore.getState().deleteSelected();
    expect(useEditorStore.getState().project.pages[0]?.nodes).toHaveLength(1);
  });

  it("does not move locked elements", () => {
    useEditorStore.getState().addText();
    const node = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.setState({
      project: {
        ...useEditorStore.getState().project,
        pages: useEditorStore.getState().project.pages.map((page) => ({
          ...page,
          nodes: page.nodes.map((item) => ({ ...item, locked: true })),
        })),
      },
    });

    useEditorStore.getState().moveNodes([node.id], 100, 100);
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.layout.x).toBe(node.layout.x);
  });
});

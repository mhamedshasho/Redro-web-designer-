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
      snapEnabled: true,
      isReady: true,
      storageError: null,
    });
  });

  it("groups selected elements into a nested container and ungroups them", () => {
    useEditorStore.getState().addText();
    const first = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addShape();
    const second = useEditorStore.getState().project.pages[0]!.nodes[1]!;
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().selectNode(second.id, true);
    useEditorStore.getState().groupSelected();

    const grouped = useEditorStore.getState().project.pages[0]!.nodes;
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.type).toBe("container");
    expect(grouped[0]!.children).toHaveLength(2);

    useEditorStore.getState().ungroupSelected();
    const ungrouped = useEditorStore.getState().project.pages[0]!.nodes;
    expect(ungrouped).toHaveLength(2);
    expect(ungrouped.map((node) => node.id)).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it("edits and deletes a nested child node", () => {
    useEditorStore.getState().addText();
    const first = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addShape();
    const second = useEditorStore.getState().project.pages[0]!.nodes[1]!;
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().selectNode(second.id, true);
    useEditorStore.getState().groupSelected();
    useEditorStore.getState().updateNodeText(first.id, "Nested text");
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.children[0]!.text).toBe("Nested text");
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().deleteSelected();
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.children).toHaveLength(1);
  });

  it("updates page layout settings and supports undo", () => {
    useEditorStore.getState().commitHistory();
    useEditorStore.getState().updatePageLayout({ mode: "grid", columns: 4, gap: 24 });
    const page = useEditorStore.getState().project.pages[0]!;
    expect(page.layout.mode).toBe("grid");
    expect(page.layout.columns).toBe(4);
    expect(page.layout.gap).toBe(24);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.pages[0]!.layout.mode).toBe("free");
  });

  it("adds and selects a text node", () => {
    useEditorStore.getState().addText();

    const state = useEditorStore.getState();
    expect(state.project.pages[0]?.nodes).toHaveLength(1);
    expect(state.selectedNodeIds).toHaveLength(1);
  });

  it("adds a rectangle shape to the document", () => {
    useEditorStore.getState().addShape();
    const node = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    expect(node.type).toBe("shape");
    expect(node.name).toBe("Rectangle");
    expect(node.style.backgroundColor).toBe("#ef3340");
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

  it("updates visual styles and restores them with undo", () => {
    useEditorStore.getState().addText();
    const node = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().commitHistory();
    useEditorStore.getState().updateNodeStyle(node.id, { color: "#ff3344", fontSize: 42 });
    const changed = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    expect(changed.style.color).toBe("#ff3344");
    expect(changed.style.fontSize).toBe(42);

    useEditorStore.getState().undo();
    const restored = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    expect(restored.style.color).toBe(node.style.color);
    expect(restored.style.fontSize).toBe(node.style.fontSize);
  });

  it("toggles layer visibility and lock state", () => {
    useEditorStore.getState().addText();
    const node = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().toggleNodeVisibility(node.id);
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.visible).toBe(false);
    useEditorStore.getState().toggleNodeLock(node.id);
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.locked).toBe(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.locked).toBe(false);
  });

  it("snaps selected elements to the 8px grid", () => {
    useEditorStore.getState().addText();
    const node = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().updateNodeLayout(node.id, { x: 83, y: 91 });
    useEditorStore.getState().selectNode(node.id);
    useEditorStore.getState().snapSelectedToGrid();
    const snapped = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    expect(snapped.layout.x).toBe(80);
    expect(snapped.layout.y).toBe(88);
  });

  it("aligns multiple selected elements to the same left edge", () => {
    useEditorStore.getState().addText();
    const first = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addShape();
    const second = useEditorStore.getState().project.pages[0]!.nodes[1]!;
    useEditorStore.getState().updateNodeLayout(first.id, { x: 60 });
    useEditorStore.getState().updateNodeLayout(second.id, { x: 240 });
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().selectNode(second.id, true);
    useEditorStore.getState().alignSelected("left");
    const nodes = useEditorStore.getState().project.pages[0]!.nodes;
    expect(nodes[0]!.layout.x).toBe(nodes[1]!.layout.x);
  });

  it("reorders layers without changing their identities", () => {
    useEditorStore.getState().addText();
    const first = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addShape();
    const second = useEditorStore.getState().project.pages[0]!.nodes[1]!;
    useEditorStore.getState().moveLayer(first.id, "forward");
    const nodes = useEditorStore.getState().project.pages[0]!.nodes;
    expect(nodes[1]!.id).toBe(first.id);
    expect(nodes[0]!.id).toBe(second.id);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.pages[0]!.nodes[0]!.id).toBe(first.id);
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

  it("duplicates a container with fresh IDs for every nested node", () => {
    useEditorStore.getState().addText();
    const first = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addShape();
    const second = useEditorStore.getState().project.pages[0]!.nodes[1]!;
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().selectNode(second.id, true);
    useEditorStore.getState().groupSelected();
    const originalGroup = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().duplicateSelected();
    const roots = useEditorStore.getState().project.pages[0]!.nodes;
    expect(roots).toHaveLength(2);
    const copy = roots[1]!;
    expect(copy.children).toHaveLength(2);
    expect(copy.id).not.toBe(originalGroup.id);
    expect(copy.children[0]!.id).not.toBe(originalGroup.children[0]!.id);
    expect(copy.children[1]!.id).not.toBe(originalGroup.children[1]!.id);
  });

  it("reorders nested siblings without moving them out of their container", () => {
    useEditorStore.getState().addText();
    const first = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addShape();
    const second = useEditorStore.getState().project.pages[0]!.nodes[1]!;
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().selectNode(second.id, true);
    useEditorStore.getState().groupSelected();
    useEditorStore.getState().moveLayer(first.id, "forward");
    const group = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    expect(group.children[1]!.id).toBe(first.id);
    expect(group.children[0]!.id).toBe(second.id);
  });
  it("does not insert elements into a nested container under a locked ancestor", () => {
    useEditorStore.getState().addContainer();
    const outer = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    useEditorStore.getState().addContainer();
    const inner = useEditorStore.getState().project.pages[0]!.nodes[0]!.children[0]!;
    useEditorStore.setState((state) => ({
      project: {
        ...state.project,
        pages: state.project.pages.map((page) => ({
          ...page,
          nodes: page.nodes.map((node) => node.id === outer.id ? { ...node, locked: true } : node),
        })),
      },
    }));
    useEditorStore.getState().selectNode(inner.id);
    useEditorStore.getState().addText();
    const updatedOuter = useEditorStore.getState().project.pages[0]!.nodes[0]!;
    expect(updatedOuter.children[0]!.children).toHaveLength(0);
    expect(updatedOuter.children).toHaveLength(1);
  });

});

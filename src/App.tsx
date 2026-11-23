import { useEffect, useRef, type PointerEvent } from "react";
import { useEditorStore } from "./store/editor-store";
import { saveProject } from "./storage/project-storage";
import type { DocumentNode } from "./model/document";

function CanvasNode({ node, zoom }: { node: DocumentNode; zoom: number }) {
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const selectNode = useEditorStore((state) => state.selectNode);
  const updateNodeText = useEditorStore((state) => state.updateNodeText);
  const moveNodes = useEditorStore((state) => state.moveNodes);
  const resizeNode = useEditorStore((state) => state.resizeNode);
  const commitHistory = useEditorStore((state) => state.commitHistory);
  const selected = selectedNodeIds.includes(node.id);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (node.locked || event.button !== 0) return;
    event.stopPropagation();
    selectNode(node.id, event.shiftKey);
    const currentSelection = useEditorStore.getState().selectedNodeIds;
    const ids = currentSelection.includes(node.id) ? currentSelection : [node.id];
    commitHistory();
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLDivElement).dataset.dragIds = ids.join(",");
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = (event.clientX - dragRef.current.x) / zoom;
    const dy = (event.clientY - dragRef.current.y) / zoom;
    dragRef.current = { x: event.clientX, y: event.clientY };
    const ids = (event.currentTarget as HTMLDivElement).dataset.dragIds?.split(",").filter(Boolean) ?? [node.id];
    moveNodes(ids, dx, dy);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    delete (event.currentTarget as HTMLDivElement).dataset.dragIds;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (node.locked) return;
    selectNode(node.id);
    commitHistory();
    resizeRef.current = { x: event.clientX, y: event.clientY, width: node.layout.width, height: node.layout.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    resizeNode(
      node.id,
      resizeRef.current.width + (event.clientX - resizeRef.current.x) / zoom,
      resizeRef.current.height + (event.clientY - resizeRef.current.y) / zoom,
    );
  };

  const finishResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className={`canvas-node${selected ? " is-selected" : ""}${node.locked ? " is-locked" : ""}`}
      style={{
        left: node.layout.x,
        top: node.layout.y,
        width: node.layout.width,
        height: node.layout.height,
        color: node.style.color,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        textAlign: node.style.textAlign,
        opacity: node.style.opacity,
        background: node.style.backgroundColor,
        borderRadius: node.style.borderRadius,
        transform: `rotate(${node.layout.rotation}deg)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => {
        if (node.type !== "text" || node.locked) return;
        const nextText = window.prompt("Edit text", node.text);
        if (nextText !== null) updateNodeText(node.id, nextText);
      }}
      role="button"
      tabIndex={0}
      aria-label={node.name}
      aria-pressed={selected}
    >
      <span className="node-content">{node.text}</span>
      {selected && !node.locked && (
        <button
          className="resize-handle"
          type="button"
          aria-label="Resize element"
          onPointerDown={startResize}
          onPointerMove={resizeMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        />
      )}
    </div>
  );
}

export default function App() {
  const project = useEditorStore((state) => state.project);
  const isReady = useEditorStore((state) => state.isReady);
  const storageError = useEditorStore((state) => state.storageError);
  const initialize = useEditorStore((state) => state.initialize);
  const zoom = useEditorStore((state) => state.zoom);
  const addText = useEditorStore((state) => state.addText);
  const setZoom = useEditorStore((state) => state.setZoom);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const updateNodeLayout = useEditorStore((state) => state.updateNodeLayout);
  const toggleNodeVisibility = useEditorStore((state) => state.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((state) => state.toggleNodeLock);
  const nodes = project.pages[0]?.nodes ?? [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeIds[0]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isReady || storageError) return;
    const timer = window.setTimeout(() => {
      void saveProject(project).catch((error: unknown) => {
        useEditorStore.setState({
          storageError: error instanceof Error ? error.message : "Unable to save this project locally.",
        });
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project, isReady, storageError]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (editing) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (command && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (command && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        useEditorStore.getState().selectNode(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, duplicateSelected, deleteSelected]);

  if (!isReady) {
    return <div className="startup-screen">REDRO <span>WEB DESIGNER</span><p>Opening your workspace…</p></div>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Redro Web Designer home">
          <span className="brand-mark">R</span>
          <span>REDRO <strong>WEB DESIGNER</strong></span>
        </a>
        <div className="project-name">{project.name}</div>
        <div className="topbar-actions">
          <span className={storageError ? "save-state save-error" : "save-state"}><i /> {storageError ? "Storage issue" : "Auto-save enabled"}</span>
          <button className="button button-primary" type="button" disabled>Export · Coming soon</button>
        </div>
      </header>

      {storageError && <div className="storage-warning" role="status">{storageError} · Changes may not be saved on this device.</div>}
      <div className="workspace">
        <aside className="tool-rail" aria-label="Tools">
          <button className="tool-button active" type="button" aria-label="Select tool">↖</button>
          <button className="tool-button" type="button" onClick={addText} aria-label="Add text">T</button>
          <button className="tool-button" type="button" onClick={addText} aria-label="Add text element">＋</button>
          <div className="rail-divider" />
          <button className="tool-button" type="button" onClick={undo} aria-label="Undo">↶</button>
          <button className="tool-button" type="button" onClick={redo} aria-label="Redo">↷</button>
          <button className="tool-button" type="button" onClick={duplicateSelected} aria-label="Duplicate">▢</button>
          <button className="tool-button" type="button" onClick={deleteSelected} aria-label="Delete">⌫</button>
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar">
            <div className="page-label"><span className="page-dot" /> Home <span className="muted">/</span> Desktop</div>
            <div className="history-controls">
              <button type="button" onClick={undo} aria-label="Undo">Undo</button>
              <button type="button" onClick={redo} aria-label="Redo">Redo</button>
              <span className="muted">{selectedNodeIds.length} selected</span>
            </div>
            <div className="zoom-controls">
              <button type="button" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom out">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom in">＋</button>
            </div>
          </div>

          <div className="canvas-stage">
            <div
              className="website-canvas"
              style={{ transform: `scale(${zoom})` }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) useEditorStore.getState().selectNode(null);
              }}
            >
              {nodes.length === 0 ? (
                <div className="canvas-empty">
                  <div className="empty-symbol">✳</div>
                  <h1>Your website starts here</h1>
                  <p>Add an element and start designing visually.</p>
                  <button className="button button-primary" type="button" onClick={addText}>＋ Add your first text</button>
                </div>
              ) : nodes.filter((node) => node.visible).map((node) => <CanvasNode key={node.id} node={node} zoom={zoom} />)}
            </div>
          </div>

          <footer className="bottom-bar">
            <span>Page 1 of {project.pages.length}</span>
            <span>Canvas · {nodes.length} elements</span>
          </footer>
        </section>

        <aside className="inspector">
          <div className="panel-heading">Properties & Layers</div>
          {selectedNode ? (
            <div className="inspector-content">
              <span className="field-label">Selected element</span>
              <div className="selected-type">{selectedNode.type.toUpperCase()}</div>
              <span className="field-label">Content</span>
              <textarea
                value={selectedNode.text}
                onChange={(event) => useEditorStore.getState().updateNodeText(selectedNode.id, event.target.value)}
                rows={3}
              />
              <span className="field-label">Position & Size</span>
              <div className="property-grid">
                <label><small>X</small><input type="number" value={Math.round(selectedNode.layout.x)} onChange={(event) => updateNodeLayout(selectedNode.id, { x: Number(event.target.value) })} /></label>
                <label><small>Y</small><input type="number" value={Math.round(selectedNode.layout.y)} onChange={(event) => updateNodeLayout(selectedNode.id, { y: Number(event.target.value) })} /></label>
                <label><small>W</small><input type="number" min="24" value={Math.round(selectedNode.layout.width)} onChange={(event) => updateNodeLayout(selectedNode.id, { width: Number(event.target.value) })} /></label>
                <label><small>H</small><input type="number" min="24" value={Math.round(selectedNode.layout.height)} onChange={(event) => updateNodeLayout(selectedNode.id, { height: Number(event.target.value) })} /></label>
              </div>
              <span className="field-label">Rotation</span>
              <input className="rotation-input" type="number" value={selectedNode.layout.rotation} onChange={(event) => updateNodeLayout(selectedNode.id, { rotation: Number(event.target.value) })} />
              <div className="inspector-actions">
                <button type="button" onClick={duplicateSelected}>Duplicate</button>
                <button type="button" onClick={deleteSelected}>Delete</button>
              </div>
            </div>
          ) : (
            <div className="inspector-empty">
              <div className="inspector-icon">◇</div>
              <strong>No element selected</strong>
              <p>Select an element on the canvas to edit its properties.</p>
            </div>
          )}
          <div className="layers-panel">
            <div className="layers-heading">Layers <span>{nodes.length}</span></div>
            {[...nodes].reverse().map((node) => (
              <div className={selectedNodeIds.includes(node.id) ? "layer-row selected" : "layer-row"} key={node.id}>
                <button className="layer-select" type="button" onClick={() => useEditorStore.getState().selectNode(node.id)}>
                  <span>{node.type === "text" ? "T" : "◇"}</span>
                  <span className="layer-name">{node.name}</span>
                </button>
                <button className="layer-action" type="button" aria-label={node.visible ? "Hide layer" : "Show layer"} onClick={() => toggleNodeVisibility(node.id)}>{node.visible ? "◉" : "○"}</button>
                <button className={node.locked ? "layer-action locked" : "layer-action"} type="button" aria-label={node.locked ? "Unlock layer" : "Lock layer"} onClick={() => toggleNodeLock(node.id)}>{node.locked ? "▣" : "▢"}</button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

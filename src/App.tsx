import { useEffect } from "react";
import { useEditorStore } from "./store/editor-store";
import { saveProject } from "./storage/project-storage";
import type { DocumentNode } from "./model/document";

function CanvasNode({ node }: { node: DocumentNode }) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const updateNodeText = useEditorStore((state) => state.updateNodeText);
  const selected = selectedNodeId === node.id;

  return (
    <div
      className={selected ? "canvas-node is-selected" : "canvas-node"}
      style={{
        left: node.layout.x,
        top: node.layout.y,
        width: node.layout.width,
        minHeight: node.layout.height,
        color: node.style.color,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        textAlign: node.style.textAlign,
        opacity: node.style.opacity,
      }}
      onClick={(event) => {
        event.stopPropagation();
        selectNode(node.id);
      }}
      onDoubleClick={() => {
        const nextText = window.prompt("Edit text", node.text);
        if (nextText !== null) updateNodeText(node.id, nextText);
      }}
    >
      {node.text}
    </div>
  );
}

export default function App() {
  const project = useEditorStore((state) => state.project);
  const isReady = useEditorStore((state) => state.isReady);
  const storageError = useEditorStore((state) => state.storageError);
  const initialize = useEditorStore((state) => state.initialize);

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

  if (!isReady) {
    return <div className="startup-screen">REDRO <span>WEB DESIGNER</span><p>Opening your workspace…</p></div>;
  }
  const zoom = useEditorStore((state) => state.zoom);
  const addText = useEditorStore((state) => state.addText);
  const setZoom = useEditorStore((state) => state.setZoom);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const nodes = project.pages[0]?.nodes ?? [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

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
          <button className="button button-primary" type="button">Publish</button>
        </div>
      </header>

      {storageError && <div className="storage-warning" role="status">{storageError} · Changes may not be saved on this device.</div>}
      <div className="workspace">
        <aside className="tool-rail" aria-label="Tools">
          <button className="tool-button active" type="button" aria-label="Select tool">↖</button>
          <button className="tool-button" type="button" onClick={addText} aria-label="Add text">T</button>
          <button className="tool-button" type="button" onClick={addText} aria-label="Add element">＋</button>
          <div className="rail-divider" />
          <button className="tool-button" type="button" aria-label="Layers">▤</button>
          <button className="tool-button" type="button" aria-label="Assets">▧</button>
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar">
            <div className="page-label"><span className="page-dot" /> Home <span className="muted">/</span> Desktop</div>
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
              onClick={() => useEditorStore.getState().selectNode(null)}
            >
              {nodes.length === 0 ? (
                <div className="canvas-empty">
                  <div className="empty-symbol">✳</div>
                  <h1>Your website starts here</h1>
                  <p>Add an element and start designing visually.</p>
                  <button className="button button-primary" type="button" onClick={(event) => {
                    event.stopPropagation();
                    addText();
                  }}>＋ Add your first text</button>
                </div>
              ) : nodes.map((node) => <CanvasNode key={node.id} node={node} />)}
            </div>
          </div>

          <footer className="bottom-bar">
            <span>Page 1 of {project.pages.length}</span>
            <span>Canvas · {nodes.length} elements</span>
          </footer>
        </section>

        <aside className="inspector">
          <div className="panel-heading">Properties</div>
          {selectedNode ? (
            <div className="inspector-content">
              <span className="field-label">Selected element</span>
              <div className="selected-type">{selectedNode.type.toUpperCase()}</div>
              <span className="field-label">Content</span>
              <textarea
                value={selectedNode.text}
                onChange={(event) => useEditorStore.getState().updateNodeText(selectedNode.id, event.target.value)}
                rows={4}
              />
              <span className="field-label">Typography</span>
              <div className="property-value">{selectedNode.style.fontSize}px · Weight {selectedNode.style.fontWeight}</div>
              <span className="field-label">Position</span>
              <div className="property-grid">
                <div><small>X</small><strong>{Math.round(selectedNode.layout.x)}</strong></div>
                <div><small>Y</small><strong>{Math.round(selectedNode.layout.y)}</strong></div>
              </div>
            </div>
          ) : (
            <div className="inspector-empty">
              <div className="inspector-icon">◇</div>
              <strong>No element selected</strong>
              <p>Select an element on the canvas to edit its properties.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

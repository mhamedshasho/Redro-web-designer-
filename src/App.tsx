import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useEditorStore } from "./store/editor-store";
import { saveProject } from "./storage/project-storage";
import type { DocumentNode } from "./model/document";

function findNodeById(nodes: DocumentNode[], id: string): DocumentNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNodeById(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

function collectImageNodes(nodes: DocumentNode[]): DocumentNode[] {
  return nodes.flatMap((node) => [
    ...(node.type === "image" ? [node] : []),
    ...collectImageNodes(node.children),
  ]);
}

function CanvasNode({ node, zoom, layoutMode, inheritedLocked = false }: { node: DocumentNode; zoom: number; layoutMode: "free" | "flex" | "grid" | "flow"; inheritedLocked?: boolean }) {
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const selectNode = useEditorStore((state) => state.selectNode);
  const updateNodeText = useEditorStore((state) => state.updateNodeText);
  const moveNodes = useEditorStore((state) => state.moveNodes);
  const resizeNode = useEditorStore((state) => state.resizeNode);
  const commitHistory = useEditorStore((state) => state.commitHistory);
  const selected = selectedNodeIds.includes(node.id);
  const effectiveLocked = inheritedLocked || node.locked;
  const dragRef = useRef<{ x: number; y: number; committed: boolean } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const rotateRef = useRef<{ centerX: number; centerY: number; startAngle: number; rotation: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (effectiveLocked || event.button !== 0) return;
    event.stopPropagation();
    const previousSelection = useEditorStore.getState().selectedNodeIds;
    if (event.shiftKey) {
      selectNode(node.id, true);
    } else if (!previousSelection.includes(node.id)) {
      selectNode(node.id);
    }
    const ids = useEditorStore.getState().selectedNodeIds;
    if (!ids.includes(node.id) || layoutMode !== "free") return;
    dragRef.current = { x: event.clientX, y: event.clientY, committed: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLDivElement).dataset.dragIds = ids.join(",");
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = (event.clientX - dragRef.current.x) / zoom;
    const dy = (event.clientY - dragRef.current.y) / zoom;
    if (!dragRef.current.committed) {
      commitHistory();
      dragRef.current.committed = true;
    }
    dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY };
    const ids = (event.currentTarget as HTMLDivElement).dataset.dragIds?.split(",").filter(Boolean) ?? [node.id];
    moveNodes(ids, dx, dy);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.committed && useEditorStore.getState().snapEnabled) {
      useEditorStore.getState().snapSelectedToGrid();
    }
    dragRef.current = null;
    delete (event.currentTarget as HTMLDivElement).dataset.dragIds;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (effectiveLocked) return;
    selectNode(node.id);
    commitHistory();
    resizeRef.current = { x: event.clientX, y: event.clientY, width: node.layout.width, height: node.layout.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    resizeNode(
      node.id,
      resizeRef.current.width + (event.clientX - resizeRef.current.x) / zoom,
      resizeRef.current.height + (event.clientY - resizeRef.current.y) / zoom,
    );
  };

  const finishResize = (event: PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const startRotate = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (effectiveLocked) return;
    selectNode(node.id);
    commitHistory();
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    rotateRef.current = {
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
      rotation: node.layout.rotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveRotate = (event: PointerEvent<HTMLButtonElement>) => {
    if (!rotateRef.current) return;
    const angle = Math.atan2(event.clientY - rotateRef.current.centerY, event.clientX - rotateRef.current.centerX) * 180 / Math.PI;
    const rotation = rotateRef.current.rotation + angle - rotateRef.current.startAngle;
    useEditorStore.getState().updateNodeLayout(node.id, { rotation: Math.round(rotation) });
  };

  const finishRotate = (event: PointerEvent<HTMLButtonElement>) => {
    rotateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className={`canvas-node${selected ? " is-selected" : ""}${effectiveLocked ? " is-locked" : ""}`}
      style={{
        position: layoutMode === "free" ? "absolute" : "relative",
        left: layoutMode === "free" ? node.layout.x : undefined,
        top: layoutMode === "free" ? node.layout.y : undefined,
        width: node.layout.width,
        height: node.layout.height,
        color: node.style.color,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        fontFamily: node.style.fontFamily,
        fontStyle: node.style.fontStyle ?? "normal",
        textDecoration: node.style.textDecoration ?? "none",
        lineHeight: node.style.lineHeight ?? 1.2,
        letterSpacing: node.style.letterSpacing ?? 0,
        textAlign: node.style.textAlign,
        opacity: node.style.opacity,
        background: node.style.backgroundColor,
        borderRadius: node.style.borderRadius,
        display: node.type === "container" ? (node.layout.mode === "grid" ? "grid" : node.layout.mode === "free" ? "block" : "flex") : "flex",
        flexDirection: node.type === "container" && node.layout.mode === "flex" ? (node.layout.direction ?? "column") : undefined,
        gridTemplateColumns: node.type === "container" && node.layout.mode === "grid" ? `repeat(${node.layout.columns ?? 2}, minmax(0, 1fr))` : undefined,
        gap: node.type === "container" ? (node.layout.gap ?? 12) : undefined,
        padding: node.type === "container" ? (node.layout.padding ?? 12) : undefined,
        justifyContent: node.type === "container" ? (node.layout.justifyContent === "start" ? "flex-start" : node.layout.justifyContent === "end" ? "flex-end" : node.layout.justifyContent ?? "flex-start") : undefined,
        alignItems: node.type === "container" ? (node.layout.alignItems === "start" ? "flex-start" : node.layout.alignItems === "end" ? "flex-end" : node.layout.alignItems ?? "flex-start") : undefined,
        transform: `rotate(${node.layout.rotation}deg)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => {
        if (node.type !== "text" || effectiveLocked) return;
        const nextText = window.prompt("Edit text", node.text);
        if (nextText !== null && nextText !== node.text) {
          commitHistory();
          updateNodeText(node.id, nextText);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={node.name}
      aria-pressed={selected}
    >
      {node.type === "image" ? <img className="node-image" src={node.text} alt={node.name} draggable={false} style={{ objectFit: node.layout.imageFit ?? "contain", objectPosition: `${node.layout.imagePositionX ?? 50}% ${node.layout.imagePositionY ?? 50}%`, borderRadius: node.style.borderRadius }} /> : node.type !== "container" && <span className="node-content">{node.text}</span>}
      {node.children.filter((child) => child.visible).map((child) => <CanvasNode key={child.id} node={child} zoom={zoom} layoutMode={node.layout.mode} inheritedLocked={effectiveLocked} />)}
      {selected && !effectiveLocked && (
        <>
        <button
          className="rotate-handle"
          type="button"
          aria-label="Rotate element"
          onPointerDown={startRotate}
          onPointerMove={moveRotate}
          onPointerUp={finishRotate}
          onPointerCancel={finishRotate}
        />
        <button
          className="resize-handle"
          type="button"
          aria-label="Resize element"
          onPointerDown={startResize}
          onPointerMove={resizeMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        />
        </>
      )}
    </div>
  );
}

function LayerTreeItem({ node, depth = 0 }: { node: DocumentNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const selected = selectedNodeIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  const selectNode = useEditorStore((state) => state.selectNode);
  const toggleNodeVisibility = useEditorStore((state) => state.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((state) => state.toggleNodeLock);
  const moveLayer = useEditorStore((state) => state.moveLayer);

  return (
    <div className="layer-tree-item">
      <div className={selected ? "layer-row selected" : "layer-row"} style={{ paddingLeft: 4 + depth * 14 }}>
        <button className="layer-expand" type="button" aria-label={expanded ? "Collapse children" : "Expand children"} disabled={!hasChildren} onClick={() => setExpanded((value) => !value)}>{hasChildren ? (expanded ? "▾" : "▸") : "·"}</button>
        <button className="layer-select" type="button" onClick={(event) => selectNode(node.id, event.shiftKey)}>
          <span>{node.type === "text" ? "T" : node.type === "container" ? "▣" : node.type === "image" ? "▧" : "◇"}</span>
          <span className="layer-name">{node.name}</span>
        </button>
        <button className="layer-action" type="button" aria-label={node.visible ? "Hide layer" : "Show layer"} onClick={() => toggleNodeVisibility(node.id)}>{node.visible ? "◉" : "○"}</button>
        <button className={node.locked ? "layer-action locked" : "layer-action"} type="button" aria-label={node.locked ? "Unlock layer" : "Lock layer"} onClick={() => toggleNodeLock(node.id)}>{node.locked ? "▣" : "▢"}</button>
        <button className="layer-action" type="button" aria-label="Bring layer forward" onClick={() => moveLayer(node.id, "forward")}>↑</button>
        <button className="layer-action" type="button" aria-label="Send layer backward" onClick={() => moveLayer(node.id, "backward")}>↓</button>
      </div>
      {hasChildren && expanded && <div className="layer-children">{node.children.map((child) => <LayerTreeItem key={child.id} node={child} depth={depth + 1} />)}</div>}
    </div>
  );
}

export default function App() {
  const project = useEditorStore((state) => state.project);
  const isReady = useEditorStore((state) => state.isReady);
  const storageError = useEditorStore((state) => state.storageError);
  const initialize = useEditorStore((state) => state.initialize);
  const zoom = useEditorStore((state) => state.zoom);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);
  const snapSelectedToGrid = useEditorStore((state) => state.snapSelectedToGrid);
  const alignSelected = useEditorStore((state) => state.alignSelected);
  const addText = useEditorStore((state) => state.addText);
  const addShape = useEditorStore((state) => state.addShape);
  const addContainer = useEditorStore((state) => state.addContainer);
  const addImage = useEditorStore((state) => state.addImage);
  const replaceImage = useEditorStore((state) => state.replaceImage);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageActionRef = useRef<"add" | "replace">("add");
  const replaceTargetRef = useRef<string | null>(null);
  const groupSelected = useEditorStore((state) => state.groupSelected);
  const moveSelectedIntoContainer = useEditorStore((state) => state.moveSelectedIntoContainer);
  const ungroupSelected = useEditorStore((state) => state.ungroupSelected);
  const setZoom = useEditorStore((state) => state.setZoom);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const updateNodeLayout = useEditorStore((state) => state.updateNodeLayout);
  const updateNodeStyle = useEditorStore((state) => state.updateNodeStyle);
  const toggleNodeVisibility = useEditorStore((state) => state.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((state) => state.toggleNodeLock);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const updatePageLayout = useEditorStore((state) => state.updatePageLayout);
  const pageLayout = { mode: "free" as const, direction: "row" as const, gap: 16, padding: 24, columns: 3, justifyContent: "start" as const, alignItems: "start" as const, ...project.pages[0]?.layout };
  const nodes = project.pages[0]?.nodes ?? [];
  const selectedNode = selectedNodeIds[0] ? findNodeById(nodes, selectedNodeIds[0]) : undefined;
  const selectedTargetContainer = selectedNodeIds.map((id) => findNodeById(nodes, id)).find((node) => node?.type === "container");
  const imageAssets = collectImageNodes(nodes);

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
      <div className="desktop-warning">
        <div className="desktop-warning-mark">R</div>
        <h1>Redro Web Designer</h1>
        <p>This editor is designed for desktop screens. Open it on a computer to continue designing.</p>
      </div>
      <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) { window.alert("Choose a PNG, JPEG, WebP, or GIF image."); return; }
        if (file.size > 8 * 1024 * 1024) { window.alert("Image must be 8 MB or smaller."); return; }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          const assetName = file.name.replace(/\.[^.]+$/, "");
          if (imageActionRef.current === "replace" && replaceTargetRef.current) replaceImage(replaceTargetRef.current, reader.result, assetName);
          else addImage(reader.result, assetName);
          imageActionRef.current = "add";
          replaceTargetRef.current = null;
        };
        reader.onerror = () => window.alert("Unable to read this image file.");
        reader.readAsDataURL(file);
      }} />
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
          <button className="tool-button" type="button" onClick={addShape} aria-label="Add rectangle">▰</button>
          <button className="tool-button" type="button" onClick={addContainer} aria-label="Add container">▣</button>
          <button className="tool-button" type="button" onClick={() => imageInputRef.current?.click()} aria-label="Insert image">▧</button>
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
              <button className={snapEnabled ? "snap-toggle active" : "snap-toggle"} type="button" disabled={pageLayout.mode !== "free"} onClick={() => setSnapEnabled(!snapEnabled)}>Snap 8px {snapEnabled ? "On" : "Off"}</button>
              <div className="align-controls">
                <button type="button" disabled={selectedNodeIds.length < 2 || pageLayout.mode !== "free"} onClick={() => alignSelected("left")} title="Align left">⇤</button>
                <button type="button" disabled={selectedNodeIds.length < 2} onClick={() => alignSelected("center-x")} title="Align horizontal center">↔</button>
                <button type="button" disabled={selectedNodeIds.length < 2} onClick={() => alignSelected("right")} title="Align right">⇥</button>
                <button type="button" disabled={selectedNodeIds.length < 2} onClick={() => alignSelected("top")} title="Align top">⇡</button>
                <button type="button" disabled={selectedNodeIds.length < 2} onClick={() => alignSelected("center-y")} title="Align vertical center">↕</button>
                <button type="button" disabled={selectedNodeIds.length < 2} onClick={() => alignSelected("bottom")} title="Align bottom">⇣</button>
              </div>
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
              style={{
                transform: `scale(${zoom})`,
                display: pageLayout.mode === "free" ? "block" : pageLayout.mode === "flex" ? "flex" : "grid",
                flexDirection: pageLayout.mode === "flex" ? pageLayout.direction : undefined,
                gridTemplateColumns: pageLayout.mode === "grid" ? `repeat(${pageLayout.columns}, minmax(0, 1fr))` : pageLayout.mode === "flow" ? "minmax(0, 1fr)" : undefined,
                gap: pageLayout.mode === "free" ? 0 : pageLayout.gap,
                padding: pageLayout.mode === "free" ? 0 : pageLayout.padding,
                justifyContent: pageLayout.justifyContent === "start" ? "flex-start" : pageLayout.justifyContent === "end" ? "flex-end" : pageLayout.justifyContent,
                alignItems: pageLayout.alignItems === "start" ? "flex-start" : pageLayout.alignItems === "end" ? "flex-end" : pageLayout.alignItems,
              }}
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
              ) : nodes.filter((node) => node.visible).map((node) => <CanvasNode key={node.id} node={node} zoom={zoom} layoutMode={pageLayout.mode} />)}
            </div>
          </div>

          <footer className="bottom-bar">
            <span>Page 1 of {project.pages.length}</span>
            <span>Canvas · {nodes.length} elements</span>
          </footer>
        </section>

        <aside className="inspector">
          <div className="panel-heading">Properties & Layers</div>
          <div className="page-layout-panel">
            <div className="layers-heading">Grouping <span>{selectedNodeIds.length} selected</span></div>
            <div className="inspector-actions">
              <button type="button" disabled={selectedNodeIds.length < 2} onClick={groupSelected}>Group</button>
              <button type="button" disabled={selectedNode?.type !== "container"} onClick={ungroupSelected}>Ungroup</button>
              <button type="button" disabled={!selectedTargetContainer || selectedNodeIds.length < 2 || pageLayout.mode !== "free"} onClick={() => selectedTargetContainer && moveSelectedIntoContainer(selectedTargetContainer.id)}>Move into selected container</button>
              <small className="muted">Select source layers and a target container with Shift. Reparenting currently requires Free page positioning.</small>
            </div>
          </div>
          <div className="page-layout-panel">
            <div className="layers-heading">Page layout <span>Root</span></div>
            <label><small>Layout mode</small><select value={pageLayout.mode} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ mode: event.target.value as "free" | "flex" | "grid" | "flow" })}><option value="free">Free positioning</option><option value="flex">Flexbox</option><option value="grid">CSS Grid</option><option value="flow">Flow</option></select></label>
            {pageLayout.mode !== "free" && <>
              <div className="property-grid">
                <label><small>Gap</small><input type="number" min="0" max="200" value={pageLayout.gap} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ gap: Math.max(0, Math.min(200, Number(event.target.value))) })} /></label>
                <label><small>Padding</small><input type="number" min="0" max="200" value={pageLayout.padding} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ padding: Math.max(0, Math.min(200, Number(event.target.value))) })} /></label>
              </div>
              {pageLayout.mode === "flex" && <label><small>Direction</small><select value={pageLayout.direction} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ direction: event.target.value as "row" | "column" })}><option value="row">Horizontal</option><option value="column">Vertical</option></select></label>}
              {pageLayout.mode === "grid" && <label><small>Columns</small><input type="number" min="1" max="12" value={pageLayout.columns} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ columns: Math.max(1, Math.min(12, Number(event.target.value))) })} /></label>}
              <div className="property-grid">
                <label><small>Justify</small><select value={pageLayout.justifyContent} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ justifyContent: event.target.value as typeof pageLayout.justifyContent })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="space-between">Space between</option><option value="space-around">Space around</option></select></label>
                <label><small>Align items</small><select value={pageLayout.alignItems} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updatePageLayout({ alignItems: event.target.value as typeof pageLayout.alignItems })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option></select></label>
              </div>
            </>}
          </div>
          {selectedNode ? (
            <div className="inspector-content">
              <span className="field-label">Selected element</span>
              <div className="selected-type">{selectedNode.type.toUpperCase()}</div>
              {selectedNode.type === "container" && <>
                <span className="field-label">Container layout</span>
                <label><small>Layout mode</small><select value={selectedNode.layout.mode} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { mode: event.target.value as "free" | "flex" | "grid" | "flow" })}><option value="free">Free positioning</option><option value="flex">Flexbox</option><option value="grid">CSS Grid</option><option value="flow">Flow</option></select></label>
                {selectedNode.layout.mode !== "free" && <>
                  <div className="property-grid">
                    <label><small>Gap</small><input type="number" min="0" max="200" value={selectedNode.layout.gap ?? 12} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { gap: Math.max(0, Math.min(200, Number(event.target.value))) })} /></label>
                    <label><small>Padding</small><input type="number" min="0" max="200" value={selectedNode.layout.padding ?? 12} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { padding: Math.max(0, Math.min(200, Number(event.target.value))) })} /></label>
                  </div>
                  {selectedNode.layout.mode === "flex" && <label><small>Direction</small><select value={selectedNode.layout.direction ?? "column"} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { direction: event.target.value as "row" | "column" })}><option value="row">Horizontal</option><option value="column">Vertical</option></select></label>}
                  {selectedNode.layout.mode === "grid" && <label><small>Columns</small><input type="number" min="1" max="12" value={selectedNode.layout.columns ?? 2} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { columns: Math.max(1, Math.min(12, Number(event.target.value))) })} /></label>}
                  <div className="property-grid">
                    <label><small>Justify</small><select value={selectedNode.layout.justifyContent ?? "start"} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { justifyContent: event.target.value as "start" | "center" | "end" | "space-between" | "space-around" })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="space-between">Space between</option><option value="space-around">Space around</option></select></label>
                    <label><small>Align items</small><select value={selectedNode.layout.alignItems ?? "start"} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { alignItems: event.target.value as "start" | "center" | "end" | "stretch" })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option></select></label>
                  </div>
                </>}
              </>}

              {selectedNode.type === "image" ? <>
                <span className="field-label">Image asset</span>
                <button type="button" className="inspector-reset" onClick={() => { imageActionRef.current = "replace"; replaceTargetRef.current = selectedNode.id; imageInputRef.current?.click(); }}>Replace image</button>
                <span className="asset-filename">{selectedNode.name}</span>
                <span className="field-label">Image fit</span>
                <select value={selectedNode.layout.imageFit ?? "contain"} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { imageFit: event.target.value as "contain" | "cover" | "fill" })}><option value="contain">Contain</option><option value="cover">Cover / Crop</option><option value="fill">Stretch</option></select>
                <span className="field-label">Crop position</span>
                <label><small>Horizontal</small><input type="range" min="0" max="100" value={selectedNode.layout.imagePositionX ?? 50} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { imagePositionX: Number(event.target.value) })} /></label>
                <label><small>Vertical</small><input type="range" min="0" max="100" value={selectedNode.layout.imagePositionY ?? 50} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { imagePositionY: Number(event.target.value) })} /></label>
                <button type="button" className="inspector-reset" onClick={() => { useEditorStore.getState().commitHistory(); updateNodeLayout(selectedNode.id, { imagePositionX: 50, imagePositionY: 50 }); }}>Reset crop position</button>
              </> : <>
                <span className="field-label">Content</span>
                <textarea
                  value={selectedNode.text}
                  onFocus={() => useEditorStore.getState().commitHistory()}
                  onChange={(event) => useEditorStore.getState().updateNodeText(selectedNode.id, event.target.value)}
                  rows={3}
                />
              </>}
              <span className="field-label">Position & Size</span>
              <div className="property-grid">
                <label><small>X</small><input type="number" value={Math.round(selectedNode.layout.x)} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { x: Number(event.target.value) })} /></label>
                <label><small>Y</small><input type="number" value={Math.round(selectedNode.layout.y)} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { y: Number(event.target.value) })} /></label>
                <label><small>W</small><input type="number" min="24" value={Math.round(selectedNode.layout.width)} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { width: Number(event.target.value) })} /></label>
                <label><small>H</small><input type="number" min="24" value={Math.round(selectedNode.layout.height)} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { height: Number(event.target.value) })} /></label>
              </div>
              <span className="field-label">Rotation</span>
              <input className="rotation-input" type="number" value={selectedNode.layout.rotation} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeLayout(selectedNode.id, { rotation: Number(event.target.value) })} />
              {selectedNode.type === "text" && <>
                <span className="field-label">Typography</span>
                <label><small>Font family</small><select value={selectedNode.style.fontFamily} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { fontFamily: event.target.value })}>
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Helvetica, sans-serif">Helvetica</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="'Courier New', monospace">Courier New</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                  <option value="Tahoma, sans-serif">Tahoma</option>
                  <option value="system-ui, sans-serif">System UI</option>
                </select></label>
                <div className="property-grid">
                  <label><small>Weight</small><select value={selectedNode.style.fontWeight} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { fontWeight: Number(event.target.value) })}><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semi bold</option><option value="700">Bold</option><option value="800">Extra bold</option><option value="900">Black</option></select></label>
                  <label><small>Style</small><select value={selectedNode.style.fontStyle ?? "normal"} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { fontStyle: event.target.value as "normal" | "italic" })}><option value="normal">Normal</option><option value="italic">Italic</option></select></label>
                </div>
                <div className="property-grid">
                  <label><small>Decoration</small><select value={selectedNode.style.textDecoration ?? "none"} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { textDecoration: event.target.value as "none" | "underline" | "line-through" })}><option value="none">None</option><option value="underline">Underline</option><option value="line-through">Strike through</option></select></label>
                  <label><small>Line height</small><input type="number" min="0.8" max="3" step="0.1" value={selectedNode.style.lineHeight ?? 1.2} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { lineHeight: Math.max(0.8, Math.min(3, Number(event.target.value))) })} /></label>
                </div>
                <label><small>Letter spacing</small><input type="number" min="-5" max="30" step="0.5" value={selectedNode.style.letterSpacing ?? 0} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { letterSpacing: Math.max(-5, Math.min(30, Number(event.target.value))) })} /></label>
              </>}
              <span className="field-label">Appearance</span>
              <div className="style-grid">
                <label><small>Text color</small><input type="color" value={selectedNode.style.color} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { color: event.target.value })} /></label>
                <label><small>Background</small><input type="color" value={selectedNode.style.backgroundColor === "transparent" ? "#202027" : selectedNode.style.backgroundColor} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { backgroundColor: event.target.value })} /></label>
                <label><small>Font size</small><input type="number" min="8" max="160" value={selectedNode.style.fontSize} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { fontSize: Math.max(8, Math.min(160, Number(event.target.value))) })} /></label>
                <label><small>Corner radius</small><input type="number" min="0" max="200" value={selectedNode.style.borderRadius} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { borderRadius: Math.max(0, Math.min(200, Number(event.target.value))) })} /></label>
                <label><small>Opacity</small><input type="range" min="0.1" max="1" step="0.05" value={selectedNode.style.opacity} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { opacity: Number(event.target.value) })} /></label>
                <label><small>Alignment</small><select value={selectedNode.style.textAlign} onFocus={() => useEditorStore.getState().commitHistory()} onChange={(event) => updateNodeStyle(selectedNode.id, { textAlign: event.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
              </div>
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
          <div className="assets-panel">
            <div className="layers-heading">Image assets <span>{imageAssets.length} total</span></div>
            {imageAssets.length === 0 ? <p className="assets-empty">Images added to this page will appear here.</p> : imageAssets.map((asset) => (
              <div className={`asset-row${selectedNodeIds.includes(asset.id) ? " selected" : ""}`} key={asset.id}>
                <button type="button" className="asset-select" onClick={() => useEditorStore.getState().selectNode(asset.id)}>
                  <img src={asset.text} alt="" />
                  <span>{asset.name}</span>
                </button>
                <button type="button" className="asset-replace" title="Replace image" aria-label={`Replace ${asset.name}`} onClick={() => { imageActionRef.current = "replace"; replaceTargetRef.current = asset.id; imageInputRef.current?.click(); }}>↻</button>
              </div>
            ))}
          </div>
          <div className="layers-panel">
            <div className="layers-heading">Layers <span>{nodes.reduce((total, node) => {
              const countTree = (item: DocumentNode): number => 1 + item.children.reduce((sum, child) => sum + countTree(child), 0);
              return total + countTree(node);
            }, 0)}</span></div>
            {[...nodes].reverse().map((node) => <LayerTreeItem key={node.id} node={node} />)}
          </div>
        </aside>
      </div>
    </main>
  );
}

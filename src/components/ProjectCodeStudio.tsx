import { useEffect, useMemo, useRef, useState } from "react";

export type ProjectFile = { path: string; content: string; kind: "html" | "css" | "js" | "asset" };
type SelectedElement = { id: string; tag: string; text: string; color: string; background: string; fontSize: string; width: string; height: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}

function buildPreview(files: ProjectFile[], htmlPath: string): string {
  let html = files.find((file) => file.path === htmlPath)?.content ?? "";
  const originalMarkup = html;
  const styles = files.filter((file) => file.kind === "css");
  const scripts = files.filter((file) => file.kind === "js");
  for (const file of styles) {
    const name = file.path.split("/").pop() ?? file.path;
    const pattern = new RegExp(`<link\\b[^>]*href=["'](?:\\./)?(?:[^"']*/)?${escapeRegExp(name)}["'][^>]*>`, "gi");
    html = html.replace(pattern, "");
  }
  for (const file of scripts) {
    const name = file.path.split("/").pop() ?? file.path;
    const pattern = new RegExp(`<script\\b(?=[^>]*src=["'](?:\\./)?(?:[^"']*/)?${escapeRegExp(name)}["'])[^>]*>\\s*</script>`, "gi");
    html = html.replace(pattern, "");
  }
  const styleMarkup = styles.map((file) => `<style data-redro-file="${file.path}">\\n${file.content}\\n</style>`).join("\\n");
  const scriptMarkup = scripts.map((file) => `<script data-redro-file="${file.path}">\\n${file.content}\\n</script>`).join("\\n");
  const editorScript = `<script id="redro-visual-editor">
  (() => {
    const originalMarkup = ${JSON.stringify(originalMarkup)};
    let visualMode = false;
    let selectedId = "";
    const send = (type, payload) => parent.postMessage({ source: "redro-project-editor", type, payload }, "*");
    const describe = (element) => {
      if (!element || ["HTML", "BODY", "SCRIPT", "STYLE", "META", "LINK", "HEAD"].includes(element.tagName)) return;
      if (!element.dataset.redroEditorId) element.dataset.redroEditorId = "node-" + Math.random().toString(36).slice(2);
      const style = getComputedStyle(element);
      send("select", { id: element.dataset.redroEditorId, tag: element.tagName.toLowerCase(), text: (element.innerText || element.alt || "").slice(0, 500), color: style.color, background: style.backgroundColor, fontSize: style.fontSize, width: Math.round(element.getBoundingClientRect().width) + "px", height: Math.round(element.getBoundingClientRect().height) + "px" });
    };
    document.addEventListener("click", (event) => {
      if (!visualMode) return;
      const target = event.target instanceof Element ? event.target.closest("*") : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (selectedId) document.querySelectorAll("[data-redro-editor-selected]").forEach((item) => item.removeAttribute("data-redro-editor-selected"));
      describe(target);
      selectedId = target.dataset.redroEditorId || "";
      target.setAttribute("data-redro-editor-selected", "true");
    }, true);
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.source !== "redro-parent-editor") return;
      if (data.type === "mode") visualMode = Boolean(data.enabled);\n      if (data.type === "export") {\n        const copy = document.documentElement.cloneNode(true);\n        copy.querySelectorAll("[data-redro-file], #redro-visual-editor, #redro-editor-marker, [data-redro-editor-selected], [data-redro-editor-id]").forEach((node) => {\n          if (node.tagName === "SCRIPT" || node.tagName === "STYLE") node.remove();\n          else { node.removeAttribute("data-redro-editor-selected"); node.removeAttribute("data-redro-editor-id"); }\n        });\n        const original = new DOMParser().parseFromString(originalMarkup, "text/html");\n        original.querySelectorAll(\x27link[rel="stylesheet"]\x27).forEach((node) => copy.querySelector("head")?.appendChild(node.cloneNode(true)));\n        original.querySelectorAll("script[src]").forEach((node) => copy.querySelector("body")?.appendChild(node.cloneNode(true)));\n        send("export", "<!doctype html>\\n" + copy.outerHTML);\n      }
      if (data.type === "update" && selectedId) {
        const element = document.querySelector('[data-redro-editor-id="' + CSS.escape(selectedId) + '"]');
        if (!element) return;
        const { property, value } = data.payload;
        if (property === "text") element.textContent = value;
        else if (["color", "backgroundColor", "fontSize", "width", "height"].includes(property)) element.style[property] = value;
        describe(element);
      }
    });
    const marker = document.createElement("style");
    marker.id = "redro-editor-marker";
    marker.textContent = '[data-redro-editor-selected="true"]{outline:2px solid #ef3340!important;outline-offset:3px!important;cursor:crosshair!important}';
    document.head.appendChild(marker);
  })();
  </script>`;
  if (styleMarkup) html = html.includes("</head>") ? html.replace("</head>", `${styleMarkup}\\n</head>`) : `${styleMarkup}\\n${html}`;
  if (scriptMarkup) html = html.includes("</body>") ? html.replace("</body>", `${scriptMarkup}\\n</body>`) : `${html}\\n${scriptMarkup}`;
  return html.includes("</body>") ? html.replace("</body>", `${editorScript}</body>`) : html + editorScript;
}

export default function ProjectCodeStudio({ initialFiles, onClose }: { initialFiles: ProjectFile[]; onClose: () => void }) {
  const [files, setFiles] = useState(initialFiles);
  const [activePath, setActivePath] = useState(initialFiles.find((file) => file.kind === "html")?.path ?? initialFiles[0]?.path ?? "");
  const [view, setView] = useState<"code" | "visual" | "preview">("visual");
  const [minimized, setMinimized] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeFile = files.find((file) => file.path === activePath);
  const htmlPath = files.find((file) => file.kind === "html")?.path ?? activePath;
  const preview = useMemo(() => buildPreview(files, htmlPath), [files, htmlPath]);
  const dirty = files.some((file) => file.content !== initialFiles.find((original) => original.path === file.path)?.content) || files.length !== initialFiles.length;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.source !== "redro-project-editor") return;
      if (event.data.type === "select") setSelected(event.data.payload as SelectedElement);
      if (event.data.type === "export") {
        setFiles((current) => current.map((file) => file.path === htmlPath ? { ...file, content: event.data.payload as string } : file));
        window.alert("Visual changes applied to the HTML source. Download the updated HTML file to save it.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ source: "redro-parent-editor", type: "mode", enabled: view === "visual" }, "*");
  }, [view, preview, minimized]);

  const updateActive = (content: string) => setFiles((current) => current.map((file) => file.path === activePath ? { ...file, content } : file));
  const updateElement = (property: string, value: string) => iframeRef.current?.contentWindow?.postMessage({ source: "redro-parent-editor", type: "update", payload: { property, value } }, "*");
  const downloadFile = (file: ProjectFile) => {
    const blob = new Blob([file.content], { type: file.kind === "html" ? "text/html;charset=utf-8" : file.kind === "css" ? "text/css;charset=utf-8" : file.kind === "js" ? "text/javascript;charset=utf-8" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.path.split("/").pop() || "project-file";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  if (minimized) return <button className="project-studio-restore" type="button" onClick={() => setMinimized(false)}>REDRO PROJECT · {dirty ? "● " : ""}Restore editor</button>;

  return <div className="project-studio-backdrop">
    <section className="project-studio" role="dialog" aria-modal="true" aria-label="External website project workspace">
      <header className="project-studio-header">
        <div><strong>REDRO <span>PROJECT WORKSPACE</span></strong><small>{files.length} files · {dirty ? "Unsaved changes" : "Original files loaded"} · Current Redro project remains open</small></div>
        <div className="project-studio-actions">
          <button type="button" onClick={() => setView("visual")} className={view === "visual" ? "active" : ""}>Visual edit</button>
          <button type="button" onClick={() => setView("code")} className={view === "code" ? "active" : ""}>Code editor</button>
          <button type="button" onClick={() => setView("preview")} className={view === "preview" ? "active" : ""}>Preview</button>
          <button type="button" onClick={() => setMinimized(true)}>Minimize</button>
          <button type="button" onClick={() => { if (!dirty || window.confirm("Close without saving your edits?")) onClose(); }}>Close</button>
        </div>
      </header>
      <div className="project-studio-body">
        <aside className="project-file-list">
          <strong>PROJECT FILES</strong>
          {files.map((file) => <button type="button" key={file.path} className={file.path === activePath ? "selected" : ""} onClick={() => { setActivePath(file.path); setSelected(null); setView("code"); }}>
            <span>{file.kind === "html" ? "⌑" : file.kind === "css" ? "◇" : file.kind === "js" ? "JS" : "▧"}</span>{file.path}
          </button>)}
          <p>Open a second project without replacing the Redro design currently in the background.</p>
        </aside>
        <main className="project-studio-main">
          {view === "code" ? <>
            <div className="project-editor-heading"><span>{activePath || "Select a file"}</span>{activeFile && <button type="button" onClick={() => downloadFile(activeFile)}>Download file</button>}</div>
            {activeFile && activeFile.kind !== "asset" ? <textarea className="project-code-editor" spellCheck={false} value={activeFile.content} onChange={(event) => updateActive(event.target.value)} aria-label={`Edit ${activePath}`} /> : <div className="project-asset-message">Supporting assets remain listed and preserved. Text editing is available for HTML, CSS and JavaScript files.</div>}
          </> : <>
            <div className="project-editor-heading"><span>{view === "visual" ? "Select an element in the page to edit its appearance" : "Visitor preview"}</span></div>
            <iframe ref={iframeRef} className="project-live-preview" title="Website visual editor preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview} />
          </>}
        </main>
        {view === "visual" && <aside className="project-inspector">
          <strong>ELEMENT PROPERTIES</strong>
          {selected ? <>
            <small>{selected.tag.toUpperCase()} · {selected.id}</small>
            <label>Text / Content<input value={selected.text} onChange={(event) => { setSelected({ ...selected, text: event.target.value }); updateElement("text", event.target.value); }} /></label>
            <label>Text color<input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.color) ? selected.color : "#222222"} onChange={(event) => { setSelected({ ...selected, color: event.target.value }); updateElement("color", event.target.value); }} /></label>
            <label>Background<input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.background) ? selected.background : "#ffffff"} onChange={(event) => { setSelected({ ...selected, background: event.target.value }); updateElement("backgroundColor", event.target.value); }} /></label>
            <label>Font size<input value={selected.fontSize} onChange={(event) => { setSelected({ ...selected, fontSize: event.target.value }); updateElement("fontSize", event.target.value); }} /></label>
            <label>Width<input value={selected.width} onChange={(event) => { setSelected({ ...selected, width: event.target.value }); updateElement("width", event.target.value); }} /></label>
            <label>Height<input value={selected.height} onChange={(event) => { setSelected({ ...selected, height: event.target.value }); updateElement("height", event.target.value); }} /></label>
          </> : <p>Click any visible element in the page to select it and edit its text, colors, size and dimensions.</p>}
          <button type="button" onClick={() => iframeRef.current?.contentWindow?.postMessage({ source: "redro-parent-editor", type: "export" }, "*")}>Apply visual edits to HTML</button>
          <small>Apply visual edits to write them into the HTML source, then download the updated file.</small>
        </aside>}
      </div>
      <footer className="project-studio-footer">
        <span>{view === "visual" ? "Visual selection is active. Switch to Preview to test links and page behavior." : "Your current Redro design project is kept separately from this imported project."}</span>
        <div>{files.filter((file) => file.kind !== "asset").map((file) => <button key={file.path} type="button" onClick={() => downloadFile(file)}>Save {file.path.split("/").pop()}</button>)}</div>
      </footer>
    </section>
  </div>;
}

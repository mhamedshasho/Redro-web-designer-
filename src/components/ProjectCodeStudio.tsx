import { useEffect, useMemo, useState } from "react";

export type ProjectFile = { path: string; content: string; kind: "html" | "css" | "js" | "asset" };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPreview(files: ProjectFile[], htmlPath: string): string {
  let html = files.find((file) => file.path === htmlPath)?.content ?? "";
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
  const styleMarkup = styles.map((file) => `<style data-redro-file="${file.path}">\n${file.content}\n</style>`).join("\n");
  const scriptMarkup = scripts.map((file) => `<script data-redro-file="${file.path}">\n${file.content}\n</script>`).join("\n");
  if (styleMarkup) html = html.includes("</head>") ? html.replace("</head>", `${styleMarkup}\n</head>`) : `${styleMarkup}\n${html}`;
  if (scriptMarkup) html = html.includes("</body>") ? html.replace("</body>", `${scriptMarkup}\n</body>`) : `${html}\n${scriptMarkup}`;
  return html;
}

export default function ProjectCodeStudio({ initialFiles, onClose }: { initialFiles: ProjectFile[]; onClose: () => void }) {
  const [files, setFiles] = useState(initialFiles);
  const [activePath, setActivePath] = useState(initialFiles.find((file) => file.kind === "html")?.path ?? initialFiles[0]?.path ?? "");
  const [view, setView] = useState<"code" | "preview">("code");
  const activeFile = files.find((file) => file.path === activePath);
  const htmlPath = files.find((file) => file.kind === "html")?.path ?? activePath;
  const preview = useMemo(() => buildPreview(files, htmlPath), [files, htmlPath]);
  const dirty = files.some((file, index) => file.content !== initialFiles.find((original) => original.path === file.path)?.content) || files.length !== initialFiles.length;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const updateActive = (content: string) => setFiles((current) => current.map((file) => file.path === activePath ? { ...file, content } : file));
  const downloadFile = (file: ProjectFile) => {
    const blob = new Blob([file.content], { type: file.kind === "html" ? "text/html;charset=utf-8" : file.kind === "css" ? "text/css;charset=utf-8" : file.kind === "js" ? "text/javascript;charset=utf-8" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.path.split("/").pop() || "project-file";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  return <div className="project-studio-backdrop">
    <section className="project-studio" role="dialog" aria-modal="true" aria-label="Open HTML project editor">
      <header className="project-studio-header">
        <div><strong>REDRO <span>PROJECT STUDIO</span></strong><small>{files.length} files · {dirty ? "Unsaved changes" : "Original files loaded"}</small></div>
        <div className="project-studio-actions">
          <button type="button" onClick={() => setView("code")} className={view === "code" ? "active" : ""}>Code editor</button>
          <button type="button" onClick={() => setView("preview")} className={view === "preview" ? "active" : ""}>Preview</button>
          <button type="button" onClick={() => { if (!dirty || window.confirm("Close without saving your edits?")) onClose(); }}>Close</button>
        </div>
      </header>
      <div className="project-studio-body">
        <aside className="project-file-list">
          <strong>PROJECT FILES</strong>
          {files.map((file) => <button type="button" key={file.path} className={file.path === activePath ? "selected" : ""} onClick={() => { setActivePath(file.path); setView("code"); }}>
            <span>{file.kind === "html" ? "⌑" : file.kind === "css" ? "◇" : file.kind === "js" ? "JS" : "▧"}</span>{file.path}
          </button>)}
          <p>Original files stay separate. Unsupported assets are kept in the project list.</p>
        </aside>
        <main className="project-studio-main">
          {view === "code" ? <>
            <div className="project-editor-heading"><span>{activePath || "Select a file"}</span>{activeFile && <button type="button" onClick={() => downloadFile(activeFile)}>Download file</button>}</div>
            {activeFile && activeFile.kind !== "asset" ? <textarea className="project-code-editor" spellCheck={false} value={activeFile.content} onChange={(event) => updateActive(event.target.value)} aria-label={`Edit ${activePath}`} /> : <div className="project-asset-message">This is a supporting asset. It is preserved in the imported project, but cannot be edited as text.</div>}
          </> : <iframe className="project-live-preview" title="Website preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview} />}
        </main>
      </div>
      <footer className="project-studio-footer">
        <span>{"Preview runs in an isolated frame. Changes are kept here until you download the edited files."}</span>
        <div>{files.filter((file) => file.kind !== "asset").map((file) => <button key={file.path} type="button" onClick={() => downloadFile(file)}>Save {file.path.split("/").pop()}</button>)}</div>
      </footer>
    </section>
  </div>;
}

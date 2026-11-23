import type { DocumentNode, NodeLayout, PageDocument, PageLayout, WebsiteProject } from "../model/document";

const shapePaths: Record<NonNullable<DocumentNode["layout"]["shapeKind"]>, string | undefined> = {
  rectangle: undefined,
  ellipse: "ellipse(50% 50% at 50% 50%)",
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%)",
  line: "polygon(0% 86%, 0% 74%, 100% 14%, 100% 26%)",
  arrow: "polygon(0% 35%, 68% 35%, 68% 5%, 100% 50%, 68% 95%, 68% 65%, 0% 65%)",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function finite(value: number | undefined, fallback: number, min = 0, max = 10000): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value as number)) : fallback;
}

function safeColor(value: string, fallback: string): string {
  return /^(transparent|#[\da-f]{3,8})$/i.test(value) ? value : fallback;
}

function safeFont(value: string): string {
  const allowed = [
    "Inter, sans-serif",
    "Arial, sans-serif",
    "Helvetica, sans-serif",
    "Georgia, serif",
    "'Times New Roman', serif",
    "'Courier New', monospace",
    "Verdana, sans-serif",
    "Tahoma, sans-serif",
    "system-ui, sans-serif",
  ];
  return allowed.includes(value) ? value : "system-ui, sans-serif";
}

function alignment(value: string): string {
  return ["left", "center", "right"].includes(value) ? value : "left";
}

function layoutStyles(layout: NodeLayout, freePosition: boolean): string {
  const mode = layout.mode;
  const position = freePosition ? "position:absolute;" : "position:relative;";
  const placement = freePosition
    ? `left:${finite(layout.x, 0)}px;top:${finite(layout.y, 0)}px;`
    : "";
  const display = mode === "grid" ? "display:grid;" : mode === "flex" ? "display:flex;" : "display:block;";
  const flow = mode === "flex"
    ? `flex-direction:${layout.direction === "row" ? "row" : "column"};gap:${finite(layout.gap, 12, 0, 200)}px;`
    : mode === "grid"
      ? `grid-template-columns:repeat(${Math.round(finite(layout.columns, 2, 1, 12))},minmax(0,1fr));gap:${finite(layout.gap, 12, 0, 200)}px;`
      : "";
  return `${position}${placement}width:${finite(layout.width, 280, 24)}px;height:${finite(layout.height, 64, 24)}px;${display}${flow}transform:rotate(${finite(layout.rotation, 0, -3600, 3600)}deg);box-sizing:border-box;`;
}

function nodeStyles(node: DocumentNode, freePosition: boolean): string {
  const { style, layout } = node;
  const font = safeFont(style.fontFamily);
  const background = safeColor(style.backgroundColor, "transparent");
  const color = safeColor(style.color, "#f5f5f7");
  const radius = finite(style.borderRadius, 0, 0, 300);
  const opacity = finite(style.opacity, 1, 0, 1);
  const common = layoutStyles(layout, freePosition);
  const typography = `color:${color};font-family:${font};font-size:${finite(style.fontSize, 16, 8, 160)}px;font-weight:${finite(style.fontWeight, 400, 100, 900)};font-style:${style.fontStyle === "italic" ? "italic" : "normal"};text-decoration:${["underline", "line-through"].includes(style.textDecoration ?? "") ? style.textDecoration : "none"};line-height:${finite(style.lineHeight, 1.2, 0.8, 3)};letter-spacing:${finite(style.letterSpacing, 0, -5, 30)}px;text-align:${alignment(style.textAlign)};opacity:${opacity};`;
  const container = node.type === "container" || node.type === "section";
  const backgroundStyle = container || node.type === "text" || node.type === "button"
    ? `background:${background};border-radius:${radius}px;`
    : "";
  const padding = container ? `padding:${finite(layout.padding, 12, 0, 200)}px;` : "padding:4px;";
  return `${common}${typography}${backgroundStyle}${padding}${container ? "overflow:visible;" : ""}`;
}

function renderNode(node: DocumentNode, parentMode: PageLayout["mode"]): string {
  if (!node.visible) return "";
  const freePosition = parentMode === "free";
  const style = nodeStyles(node, freePosition);
  const children = node.children.map((child) => renderNode(child, node.layout.mode)).join("");
  const name = escapeHtml(node.name);
  if (node.type === "image") {
    if (!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(node.text)) return "";
    return `<img class="rd-node rd-image" alt="${name}" src="${escapeHtml(node.text)}" style="${style}object-fit:${["contain", "cover", "fill"].includes(node.layout.imageFit ?? "") ? node.layout.imageFit : "contain"};object-position:${finite(node.layout.imagePositionX, 50, 0, 100)}% ${finite(node.layout.imagePositionY, 50, 0, 100)}%;border-radius:${finite(node.style.borderRadius, 0, 0, 300)}px;" />`;
  }
  if (node.type === "shape") {
    const path = shapePaths[node.layout.shapeKind ?? "rectangle"];
    const clip = path ? `clip-path:${path};` : "";
    return `<div class="rd-node rd-shape" role="img" aria-label="${name}" style="${style}background:${safeColor(node.style.backgroundColor, "#ef3340")};border-radius:${finite(node.style.borderRadius, 0, 0, 300)}px;${clip}"></div>`;
  }
  if (node.type === "button") {
    return `<button class="rd-node rd-button" type="button" style="${style}cursor:pointer;">${escapeHtml(node.text)}</button>`;
  }
  if (node.type === "container" || node.type === "section") {
    const layout = node.layout.mode;
    const flowStyle = layout === "flex"
      ? `flex-direction:${node.layout.direction === "row" ? "row" : "column"};gap:${finite(node.layout.gap, 12, 0, 200)}px;`
      : layout === "grid"
        ? `grid-template-columns:repeat(${Math.round(finite(node.layout.columns, 2, 1, 12))},minmax(0,1fr));gap:${finite(node.layout.gap, 12, 0, 200)}px;`
        : "";
    return `<div class="rd-node rd-container" aria-label="${name}" style="${style}${flowStyle}">${children}</div>`;
  }
  return `<div class="rd-node rd-text" style="${style}">${escapeHtml(node.text)}</div>`;
}

function pageStyles(page: PageDocument): string {
  const { layout } = page;
  if (layout.mode === "free") return "display:block;";
  if (layout.mode === "flex") {
    return `display:flex;flex-direction:${layout.direction};gap:${finite(layout.gap, 16, 0, 200)}px;padding:${finite(layout.padding, 24, 0, 300)}px;justify-content:${layout.justifyContent === "start" ? "flex-start" : layout.justifyContent === "end" ? "flex-end" : layout.justifyContent};align-items:${layout.alignItems === "start" ? "flex-start" : layout.alignItems === "end" ? "flex-end" : layout.alignItems};`;
  }
  if (layout.mode === "grid") {
    return `display:grid;grid-template-columns:repeat(${Math.round(finite(layout.columns, 3, 1, 12))},minmax(0,1fr));gap:${finite(layout.gap, 16, 0, 200)}px;padding:${finite(layout.padding, 24, 0, 300)}px;`;
  }
  return `display:flex;flex-direction:column;gap:${finite(layout.gap, 16, 0, 200)}px;padding:${finite(layout.padding, 24, 0, 300)}px;`;
}

export function exportWebsiteHtml(project: WebsiteProject): string {
  const page = project.pages[0];
  if (!page) throw new Error("This project has no page to export.");
  const title = escapeHtml(page.title || project.name || "Website");
  const content = page.nodes.map((node) => renderNode(node, page.layout.mode)).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${escapeHtml(project.name)}">
<title>${title}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif}
body{background:#f4f4f5;color:#18181b}
.rd-page{position:relative;width:min(100%,900px);min-height:620px;margin:0 auto;background:#202027;color:#f5f5f7;overflow:hidden;${pageStyles(page)}}
.rd-node{box-sizing:border-box;min-width:0;min-height:0}
.rd-text{white-space:pre-wrap;overflow-wrap:anywhere}
.rd-image{display:block;max-width:100%}
.rd-container{min-width:0}
.rd-button{border:0;padding:10px 16px;border-radius:6px}
@media(max-width:600px){.rd-page{width:100%;min-height:100vh}}
</style>
</head>
<body>
<main class="rd-page">${content}</main>
</body>
</html>`;
}

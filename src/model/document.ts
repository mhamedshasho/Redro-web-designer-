export type NodeType = "section" | "container" | "text" | "image" | "shape" | "button";

export type LayoutMode = "free" | "flex" | "grid" | "flow";

export interface NodeLayout {
  mode: LayoutMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  direction?: "row" | "column";
  gap?: number;
  padding?: number;
  columns?: number;
  justifyContent?: "start" | "center" | "end" | "space-between" | "space-around";
  alignItems?: "start" | "center" | "end" | "stretch";
  imageFit?: "contain" | "cover" | "fill";
}

export interface NodeStyle {
  backgroundColor: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: "left" | "center" | "right";
  borderRadius: number;
  opacity: number;
}

export interface DocumentNode {
  id: string;
  type: NodeType;
  name: string;
  text: string;
  layout: NodeLayout;
  style: NodeStyle;
  visible: boolean;
  locked: boolean;
  children: DocumentNode[];
}

export interface PageLayout {
  mode: LayoutMode;
  direction: "row" | "column";
  gap: number;
  padding: number;
  columns: number;
  justifyContent: "start" | "center" | "end" | "space-between" | "space-around";
  alignItems: "start" | "center" | "end" | "stretch";
}

export interface PageDocument {
  id: string;
  name: string;
  slug: string;
  title: string;
  layout: PageLayout;
  nodes: DocumentNode[];
}

export interface WebsiteProject {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  pages: PageDocument[];
}

export const CURRENT_SCHEMA_VERSION = 1;

export function createId(): string {
  return crypto.randomUUID();
}

export function createTextNode(x = 80, y = 80): DocumentNode {
  return {
    id: createId(),
    type: "text",
    name: "Text",
    text: "Double-click to edit",
    layout: { mode: "free", x, y, width: 280, height: 64, rotation: 0 },
    style: {
      backgroundColor: "transparent",
      color: "#f5f5f7",
      fontSize: 28,
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
      textAlign: "left",
      borderRadius: 0,
      opacity: 1,
    },
    visible: true,
    locked: false,
    children: [],
  };
}

export function createShapeNode(x = 120, y = 120): DocumentNode {
  const node = createTextNode(x, y);
  return {
    ...node,
    type: "shape",
    name: "Rectangle",
    text: "",
    layout: { ...node.layout, width: 180, height: 110 },
    style: { ...node.style, backgroundColor: "#ef3340", borderRadius: 8 },
  };
}

export function createImageNode(src: string, x = 140, y = 140): DocumentNode {
  const node = createTextNode(x, y);
  return {
    ...node,
    type: "image",
    name: "Image",
    text: src,
    layout: { ...node.layout, width: 320, height: 220, imageFit: "contain" },
    style: { ...node.style, backgroundColor: "#202027", borderRadius: 6 },
  };
}

export function createContainerNode(): DocumentNode {
  const node = createShapeNode(160, 160);
  return {
    ...node,
    type: "container",
    name: "Container",
    text: "",
    layout: { ...node.layout, width: 360, height: 240, mode: "flex", direction: "column", gap: 12, padding: 12, columns: 2, justifyContent: "start", alignItems: "start" },
    style: { ...node.style, backgroundColor: "#292930", borderRadius: 12 },
    children: [],
  };
}

export function createProject(name = "Untitled Website"): WebsiteProject {
  const now = new Date().toISOString();

  return {
    id: createId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    pages: [
      {
        id: createId(),
        name: "Home",
        slug: "/",
        title: "Home",
        layout: {
          mode: "free",
          direction: "row",
          gap: 16,
          padding: 24,
          columns: 3,
          justifyContent: "start",
          alignItems: "start",
        },
        nodes: [],
      },
    ],
  };
}

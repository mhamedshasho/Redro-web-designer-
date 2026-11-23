export type NodeType = "section" | "container" | "text" | "image" | "shape" | "button";

export type LayoutMode = "free" | "flex" | "grid" | "flow";

export interface NodeLayout {
  mode: LayoutMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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

export interface PageDocument {
  id: string;
  name: string;
  slug: string;
  title: string;
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
        nodes: [],
      },
    ],
  };
}

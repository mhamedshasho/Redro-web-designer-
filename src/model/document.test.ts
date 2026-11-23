import { describe, expect, it } from "vitest";
import { createProject, createTextNode, CURRENT_SCHEMA_VERSION } from "./document";

describe("document model", () => {
  it("creates a valid starter project", () => {
    const project = createProject("Demo");

    expect(project.name).toBe("Demo");
    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]?.slug).toBe("/");
  });

  it("creates a text node with editable default content", () => {
    const node = createTextNode();

    expect(node.type).toBe("text");
    expect(node.text.length).toBeGreaterThan(0);
    expect(node.layout.width).toBeGreaterThan(0);
    expect(node.visible).toBe(true);
  });
});

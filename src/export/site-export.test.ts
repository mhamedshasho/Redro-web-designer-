import { describe, expect, it } from "vitest";
import { createProject, createShapeNode, createTextNode } from "../model/document";
import { exportWebsiteHtml } from "./site-export";

describe("website HTML export", () => {
  it("exports editable text and shapes into a standalone HTML document", () => {
    const project = createProject("Redro Demo");
    const text = createTextNode(40, 60);
    text.text = "<script>alert(1)</script>";
    const shape = createShapeNode(120, 160);
    shape.layout.shapeKind = "star";
    project.pages[0]!.nodes = [text, shape];

    const html = exportWebsiteHtml(project);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("clip-path:polygon(");
    expect(html).toContain("<title>Home</title>");
  });

  it("does not export hidden elements or unsupported image sources", () => {
    const project = createProject("Hidden Demo");
    const hidden = createTextNode();
    hidden.visible = false;
    const invalidImage = createTextNode();
    invalidImage.type = "image";
    invalidImage.text = "javascript:alert(1)";
    project.pages[0]!.nodes = [hidden, invalidImage];

    const html = exportWebsiteHtml(project);

    expect(html).not.toContain("Double-click to edit");
    expect(html).not.toContain("javascript:");
  });
});

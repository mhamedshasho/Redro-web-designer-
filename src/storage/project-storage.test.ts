import { describe, expect, it } from "vitest";
import { createProject } from "../model/document";
import { getProject, listProjects, saveProject } from "./project-storage";

describe("local project storage", () => {
  it("saves and retrieves a project by its id", async () => {
    const project = createProject("Storage test");

    await saveProject(project);

    await expect(getProject(project.id)).resolves.toEqual(project);
  });

  it("lists saved projects", async () => {
    const project = createProject("List test");

    await saveProject(project);

    const projects = await listProjects();
    expect(projects.some((item) => item.id === project.id)).toBe(true);
  });
});

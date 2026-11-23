import type { WebsiteProject } from "../model/document";

const DATABASE_NAME = "redro-web-designer";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Unable to open local project storage."));
    };

    request.onblocked = () => {
      reject(new Error("Project storage is blocked by another open application tab."));
    };
  });

  return databasePromise;
}

export async function saveProject(project: WebsiteProject): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).put(project);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Project save was interrupted."));
  });
}

export async function getProject(id: string): Promise<WebsiteProject | null> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = database.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).get(id);
    request.onsuccess = () => resolve((request.result as WebsiteProject | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Unable to load project."));
  });
}

export async function listProjects(): Promise<WebsiteProject[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = database.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).getAll();
    request.onsuccess = () => {
      const projects = request.result as WebsiteProject[];
      resolve(projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to list projects."));
  });
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to delete project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Project deletion was interrupted."));
  });
}

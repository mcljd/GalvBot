import type { LayoutProject } from "@/lib/types";
import type { StorageProvider } from "./types";

const KEY = "galvbot.projects.v1";

function readAll(): Record<string, LayoutProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, LayoutProject>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, LayoutProject>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

/** Default zero-config persistence backed by localStorage. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";

  async list(): Promise<LayoutProject[]> {
    return Object.values(readAll()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  async get(id: string): Promise<LayoutProject | null> {
    return readAll()[id] ?? null;
  }

  async save(project: LayoutProject): Promise<void> {
    const map = readAll();
    map[project.id] = project;
    writeAll(map);
  }

  async remove(id: string): Promise<void> {
    const map = readAll();
    delete map[id];
    writeAll(map);
  }
}

"use client";

import * as React from "react";
import type { LayoutProject } from "@/lib/types";
import { getStorageProvider } from "@/lib/storage";
import { makeDemoProject } from "@/lib/seed/demo";
import { cloneProject, createEmptyProject } from "@/lib/project";

const SEED_FLAG = "galvbot.seeded.v1";

/**
 * Loads the project list from the active StorageProvider and seeds the demo
 * project exactly once (so a user can delete it without it reappearing).
 */
export function useProjects() {
  const [projects, setProjects] = React.useState<LayoutProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const store = getStorageProvider();
    const list = await store.list();
    setProjects(list);
    return list;
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const store = getStorageProvider();
      const seeded =
        typeof window !== "undefined" &&
        window.localStorage.getItem(SEED_FLAG) === "1";
      let list = await store.list();
      if (!seeded && list.length === 0) {
        await store.save(makeDemoProject());
        if (typeof window !== "undefined")
          window.localStorage.setItem(SEED_FLAG, "1");
        list = await store.list();
      }
      if (active) {
        setProjects(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const create = React.useCallback(
    async (name: string) => {
      const p = createEmptyProject(name);
      await getStorageProvider().save(p);
      await refresh();
      return p;
    },
    [refresh]
  );

  const duplicate = React.useCallback(
    async (project: LayoutProject) => {
      const p = cloneProject(project);
      await getStorageProvider().save(p);
      await refresh();
      return p;
    },
    [refresh]
  );

  const remove = React.useCallback(
    async (id: string) => {
      await getStorageProvider().remove(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, loading, refresh, create, duplicate, remove };
}

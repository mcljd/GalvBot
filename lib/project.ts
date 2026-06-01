import type { Floor, LayoutProject } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import { uid } from "@/lib/utils";

/** A blank rectangular floor for new manually-drawn projects. */
export function blankFloor(width = 24, height = 16): Floor {
  return {
    id: uid("floor"),
    name: "New Floor",
    boundary: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    obstacles: [],
    docks: [],
    gridResolution: 0.5,
  };
}

export function createEmptyProject(
  name = "Untitled Layout",
  floor?: Floor
): LayoutProject {
  const now = new Date().toISOString();
  return {
    id: uid("proj"),
    name,
    floor: floor ?? blankFloor(),
    machines: [],
    flows: [],
    safetyRules: [
      { id: uid("rule"), kind: "min_aisle_width", value: 1.2 },
      { id: uid("rule"), kind: "exit_clearance", value: 1.5 },
    ],
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: now,
    updatedAt: now,
  };
}

/** Duplicate a project under a fresh id (e.g. "Copy of …"). */
export function cloneProject(p: LayoutProject, name?: string): LayoutProject {
  const now = new Date().toISOString();
  const copy = structuredClone(p);
  copy.id = uid("proj");
  copy.name = name ?? `Copy of ${p.name}`;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}

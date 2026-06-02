"use client";

import { create } from "zustand";
import type {
  FlowEdge,
  Floor,
  LayoutProject,
  Machine,
  MachineType,
  ObjectiveWeights,
  Placement,
  SafetyRule,
  Vec2,
} from "@/lib/types";
import { MACHINE_META } from "@/lib/types";
import { getStorageProvider } from "@/lib/storage";
import { uid } from "@/lib/utils";
import { bbox, rotatedFootprint } from "@/lib/geometry";

export type EditorTool =
  | "select"
  | "draw_obstacle"
  | "draw_nogo"
  | "place_exit";

interface EditorState {
  project: LayoutProject | null;
  selectedId: string | null;
  tool: EditorTool;
  past: LayoutProject[];
  future: LayoutProject[];
  /** Whether to draw the flow-usage heatmap overlay. */
  showHeatmap: boolean;
  showFlows: boolean;

  // lifecycle
  load: (p: LayoutProject) => void;
  reset: () => void;

  // selection / tools
  select: (id: string | null) => void;
  setTool: (t: EditorTool) => void;
  toggleHeatmap: () => void;
  toggleFlows: () => void;

  // history
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // machine ops
  addMachine: (type: MachineType, pos: Vec2) => string;
  updateMachine: (id: string, patch: Partial<Machine>, history?: boolean) => void;
  setMachinePos: (id: string, pos: Vec2, history?: boolean) => void;
  nudgeMachine: (id: string, dx: number, dy: number) => void;
  rotateMachine: (id: string) => void;
  toggleLock: (id: string) => void;
  duplicateMachine: (id: string) => void;
  removeMachine: (id: string) => void;

  // flows
  addFlow: (from: string, to: string, unitsPerDay: number) => void;
  updateFlow: (index: number, patch: Partial<FlowEdge>) => void;
  removeFlow: (index: number) => void;

  // safety
  addSafetyRule: (rule: Omit<SafetyRule, "id">) => void;
  updateSafetyRule: (id: string, patch: Partial<SafetyRule>) => void;
  removeSafetyRule: (id: string) => void;

  // exits (egress doors)
  addExit: (pos: Vec2) => void;
  removeExit: (id: string) => void;

  // floor / weights
  updateFloor: (patch: Partial<Floor>) => void;
  setWeights: (w: ObjectiveWeights) => void;
  renameProject: (name: string) => void;

  // optimizer
  applyPlacements: (placements: Placement[]) => void;
}

const HISTORY_LIMIT = 60;

function persist(project: LayoutProject) {
  if (typeof window === "undefined") return;
  // fire-and-forget autosave
  void getStorageProvider().save(project);
}

/** Produce the next project (touch updatedAt) and persist it. */
function commit(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  mutate: (draft: LayoutProject) => void,
  history = true
) {
  const current = get().project;
  if (!current) return;
  if (history) {
    const past = [...get().past, structuredClone(current)].slice(-HISTORY_LIMIT);
    set({ past, future: [] });
  }
  const next = structuredClone(current);
  mutate(next);
  next.updatedAt = new Date().toISOString();
  set({ project: next });
  persist(next);
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  selectedId: null,
  tool: "select",
  past: [],
  future: [],
  showHeatmap: false,
  showFlows: true,

  load: (p) => set({ project: p, past: [], future: [], selectedId: null }),
  reset: () => set({ project: null, past: [], future: [], selectedId: null }),

  select: (id) => set({ selectedId: id }),
  setTool: (t) => set({ tool: t }),
  toggleHeatmap: () => set({ showHeatmap: !get().showHeatmap }),
  toggleFlows: () => set({ showFlows: !get().showFlows }),

  pushHistory: () => {
    const current = get().project;
    if (!current) return;
    const past = [...get().past, structuredClone(current)].slice(-HISTORY_LIMIT);
    set({ past, future: [] });
  },

  undo: () => {
    const { past, project } = get();
    if (!project || past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [structuredClone(project), ...get().future].slice(0, HISTORY_LIMIT),
      project: previous,
    });
    persist(previous);
  },

  redo: () => {
    const { future, project } = get();
    if (!project || future.length === 0) return;
    const next = future[0];
    set({
      future: future.slice(1),
      past: [...get().past, structuredClone(project)].slice(-HISTORY_LIMIT),
      project: next,
    });
    persist(next);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  addMachine: (type, pos) => {
    const meta = MACHINE_META[type];
    const id = uid("m");
    const count =
      (get().project?.machines.filter((m) => m.type === type).length ?? 0) + 1;
    commit(set, get, (d) => {
      d.machines.push({
        id,
        type,
        label: `${meta.label} ${count}`,
        footprint: { ...meta.defaultFootprint },
        clearance: meta.defaultClearance,
        heatOutput: meta.defaultHeat,
        rotationDeg: 0,
        pos,
      });
    });
    set({ selectedId: id });
    return id;
  },

  updateMachine: (id, patch, history = true) =>
    commit(
      set,
      get,
      (d) => {
        const m = d.machines.find((x) => x.id === id);
        if (m) Object.assign(m, patch);
      },
      history
    ),

  setMachinePos: (id, pos, history = false) =>
    commit(
      set,
      get,
      (d) => {
        const m = d.machines.find((x) => x.id === id);
        if (m) m.pos = pos;
      },
      history
    ),

  nudgeMachine: (id, dx, dy) =>
    commit(set, get, (d) => {
      const m = d.machines.find((x) => x.id === id);
      if (!m || !m.pos || m.fixed) return;
      const fb = bbox(d.floor.boundary);
      const f = rotatedFootprint(m);
      m.pos = {
        x: Math.min(Math.max(fb.x, m.pos.x + dx), Math.max(fb.x, fb.x + fb.w - f.w)),
        y: Math.min(Math.max(fb.y, m.pos.y + dy), Math.max(fb.y, fb.y + fb.h - f.d)),
      };
    }),

  rotateMachine: (id) =>
    commit(set, get, (d) => {
      const m = d.machines.find((x) => x.id === id);
      if (m) m.rotationDeg = (((m.rotationDeg ?? 0) + 90) % 360) as 0 | 90 | 180 | 270;
    }),

  toggleLock: (id) =>
    commit(set, get, (d) => {
      const m = d.machines.find((x) => x.id === id);
      if (m) m.fixed = !m.fixed;
    }),

  duplicateMachine: (id) => {
    const src = get().project?.machines.find((m) => m.id === id);
    if (!src) return;
    const newId = uid("m");
    commit(set, get, (d) => {
      d.machines.push({
        ...structuredClone(src),
        id: newId,
        label: `${src.label} (copy)`,
        fixed: false,
        pos: src.pos
          ? { x: src.pos.x + 1, y: src.pos.y + 1 }
          : { x: 1, y: 1 },
      });
    });
    set({ selectedId: newId });
  },

  removeMachine: (id) => {
    commit(set, get, (d) => {
      d.machines = d.machines.filter((m) => m.id !== id);
      d.flows = d.flows.filter((f) => f.from !== id && f.to !== id);
    });
    if (get().selectedId === id) set({ selectedId: null });
  },

  addFlow: (from, to, unitsPerDay) =>
    commit(set, get, (d) => {
      if (from === to) return; // a machine cannot flow to itself
      const existing = d.flows.find((f) => f.from === from && f.to === to);
      if (existing) existing.unitsPerDay = unitsPerDay;
      else d.flows.push({ from, to, unitsPerDay });
    }),

  updateFlow: (index, patch) =>
    commit(set, get, (d) => {
      if (d.flows[index]) Object.assign(d.flows[index], patch);
    }),

  removeFlow: (index) =>
    commit(set, get, (d) => {
      d.flows.splice(index, 1);
    }),

  addSafetyRule: (rule) =>
    commit(set, get, (d) => {
      d.safetyRules.push({ ...rule, id: uid("rule") });
    }),

  updateSafetyRule: (id, patch) =>
    commit(set, get, (d) => {
      const r = d.safetyRules.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    }),

  removeSafetyRule: (id) =>
    commit(set, get, (d) => {
      d.safetyRules = d.safetyRules.filter((r) => r.id !== id);
    }),

  addExit: (pos) =>
    commit(set, get, (d) => {
      d.floor.exits = [...(d.floor.exits ?? []), { id: uid("exit"), pos }];
    }),

  removeExit: (id) =>
    commit(set, get, (d) => {
      d.floor.exits = (d.floor.exits ?? []).filter((e) => e.id !== id);
    }),

  updateFloor: (patch) =>
    commit(set, get, (d) => {
      Object.assign(d.floor, patch);
    }),

  setWeights: (w) =>
    commit(set, get, (d) => {
      d.weights = w;
    }),

  renameProject: (name) =>
    commit(set, get, (d) => {
      d.name = name;
    }),

  applyPlacements: (placements) =>
    commit(set, get, (d) => {
      for (const p of placements) {
        const m = d.machines.find((x) => x.id === p.machineId);
        if (m && !m.fixed) {
          m.pos = p.pos;
          m.rotationDeg = p.rotationDeg;
        }
      }
    }),
}));

/** Convenience selector: current floor bounding box (meters). */
export function selectFloorBBox(project: LayoutProject | null) {
  if (!project) return { x: 0, y: 0, w: 0, h: 0 };
  return bbox(project.floor.boundary);
}

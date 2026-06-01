import type {
  LayoutProject,
  Machine,
  OptimizationResult,
  Placement,
  SolverSettings,
  Vec2,
} from "@/lib/types";
import { bbox, machineFootprintRect, overlapArea, rectsOverlap } from "@/lib/geometry";
import { rotatedFootprint } from "@/lib/geometry";
import { scoreLayout } from "./scoring";

/** Deterministic PRNG (mulberry32) so runs are reproducible from a seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MState {
  id: string;
  pos: Vec2;
  rot: 0 | 90 | 180 | 270;
  fixed: boolean;
}

function placementsFrom(state: MState[]): Placement[] {
  return state.map((s) => ({ machineId: s.id, pos: s.pos, rotationDeg: s.rot }));
}

/** Energy to minimize: lower is better. Adds a hard penalty per error so the
 *  search avoids infeasible (overlapping / out-of-bounds) layouts regardless
 *  of the user's pillar weights. */
function energy(project: LayoutProject, state: MState[]): number {
  const score = scoreLayout(project, placementsFrom(state));
  const errors = score.violations.filter((v) => v.severity === "error").length;
  return 100 - score.total + errors * 25;
}

function clampPos(
  m: Machine,
  pos: Vec2,
  floor: { x: number; y: number; w: number; h: number }
): Vec2 {
  const f = rotatedFootprint(m);
  return {
    x: Math.min(Math.max(floor.x, pos.x), Math.max(floor.x, floor.x + floor.w - f.w)),
    y: Math.min(Math.max(floor.y, pos.y), Math.max(floor.y, floor.y + floor.h - f.d)),
  };
}

/**
 * Constructive heuristic: order movable machines by flow centrality (sum of
 * connected throughput) and pack them row-by-row into free floor cells,
 * skipping obstacles and no-go zones. Fixed machines keep their position.
 */
export function constructiveInit(
  project: LayoutProject,
  rand: () => number
): MState[] {
  const floor = bbox(project.floor.boundary);
  const degree = new Map<string, number>();
  for (const f of project.flows) {
    degree.set(f.from, (degree.get(f.from) ?? 0) + f.unitsPerDay);
    degree.set(f.to, (degree.get(f.to) ?? 0) + f.unitsPerDay);
  }

  const blocked: { x: number; y: number; w: number; h: number }[] = [
    ...project.floor.obstacles.map((o) => bbox(o.polygon)),
    ...project.safetyRules
      .filter((r) => r.kind === "no_go_zone" && r.zone)
      .map((r) => bbox(r.zone!)),
  ];

  const fixed = project.machines.filter((m) => m.fixed && m.pos);
  const placedRects = fixed.map((m) => machineFootprintRect(m, m.pos!, true));

  const movable = project.machines
    .filter((m) => !m.fixed)
    .sort(
      (a, b) =>
        (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
        b.footprint.w * b.footprint.d - a.footprint.w * a.footprint.d
    );

  const state: MState[] = fixed.map((m) => ({
    id: m.id,
    pos: m.pos!,
    rot: m.rotationDeg ?? 0,
    fixed: true,
  }));

  const margin = 0.5;
  let cursorX = floor.x + margin;
  let cursorY = floor.y + margin;
  let rowH = 0;

  const fits = (rect: { x: number; y: number; w: number; h: number }) => {
    if (
      rect.x < floor.x ||
      rect.y < floor.y ||
      rect.x + rect.w > floor.x + floor.w ||
      rect.y + rect.h > floor.y + floor.h
    )
      return false;
    for (const b of blocked) if (rectsOverlap(rect, b)) return false;
    for (const r of placedRects) if (overlapArea(rect, r) > 1e-6) return false;
    return true;
  };

  for (const m of movable) {
    const f = rotatedFootprint(m);
    const fw = f.w + 2 * m.clearance;
    const fd = f.d + 2 * m.clearance;
    let placed = false;
    // try to walk along rows until a free spot is found
    for (let attempts = 0; attempts < 5000 && !placed; attempts++) {
      if (cursorX + fw > floor.x + floor.w - margin) {
        cursorX = floor.x + margin;
        cursorY += rowH + margin;
        rowH = 0;
      }
      if (cursorY + fd > floor.y + floor.h - margin) {
        // out of room — drop somewhere random inside and let SA sort it out
        cursorX = floor.x + margin + rand() * Math.max(0, floor.w - fw - margin * 2);
        cursorY = floor.y + margin + rand() * Math.max(0, floor.h - fd - margin * 2);
      }
      const rect = { x: cursorX, y: cursorY, w: fw, h: fd };
      if (fits(rect)) {
        const pos = { x: cursorX + m.clearance, y: cursorY + m.clearance };
        state.push({ id: m.id, pos, rot: m.rotationDeg ?? 0, fixed: false });
        placedRects.push(machineFootprintRect(m, pos, true));
        cursorX += fw + margin;
        rowH = Math.max(rowH, fd);
        placed = true;
      } else {
        cursorX += Math.max(0.5, project.floor.gridResolution);
      }
    }
    if (!placed) {
      // fallback: keep current/any position
      state.push({
        id: m.id,
        pos: m.pos ?? { x: floor.x + margin, y: floor.y + margin },
        rot: m.rotationDeg ?? 0,
        fixed: false,
      });
    }
  }

  // preserve original machine order
  const order = new Map(project.machines.map((m, i) => [m.id, i]));
  state.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return state;
}

export interface AnnealProgress {
  iteration: number;
  total: number; // current score
  bestTotal: number;
  bestPlacements: Placement[];
}

export interface AnnealOptions {
  settings: SolverSettings;
  /** Start from the project's current positions instead of the constructive
   *  heuristic. Useful when the user has already arranged a good layout. */
  startFromCurrent?: boolean;
  onProgress?: (p: AnnealProgress) => void;
  /** Returns true to abort early. */
  shouldStop?: () => boolean;
}

export function anneal(
  project: LayoutProject,
  opts: AnnealOptions
): OptimizationResult {
  const { settings, onProgress, shouldStop } = opts;
  const rand = mulberry32(settings.seed ?? 1234567);
  const floor = bbox(project.floor.boundary);
  const machineById = new Map(project.machines.map((m) => [m.id, m]));

  let state: MState[] = opts.startFromCurrent
    ? project.machines.map((m) => ({
        id: m.id,
        pos: m.pos ?? { x: floor.x + 0.5, y: floor.y + 0.5 },
        rot: m.rotationDeg ?? 0,
        fixed: !!m.fixed,
      }))
    : constructiveInit(project, rand);

  let current = energy(project, state);
  let best = current;
  let bestState = state.map((s) => ({ ...s, pos: { ...s.pos } }));

  const movableIdx = state
    .map((s, i) => (s.fixed ? -1 : i))
    .filter((i) => i >= 0);

  const iterations = Math.max(1, settings.iterations);
  const { startTemp, endTemp } = settings;
  const cooling = (endTemp / startTemp) ** (1 / iterations);
  let temp = startTemp;

  const mw = settings.moveWeights;
  const mwTotal = mw.translate + mw.rotate + mw.swap || 1;

  const progressEvery = Math.max(1, Math.floor(iterations / 100));

  for (let i = 0; i < iterations; i++) {
    if (shouldStop?.()) break;
    temp *= cooling;

    if (movableIdx.length > 0) {
      const next = state.map((s) => ({ ...s, pos: { ...s.pos } }));
      const roll = rand() * mwTotal;

      if (roll < mw.translate || movableIdx.length < 2) {
        // translate one machine
        const idx = movableIdx[(rand() * movableIdx.length) | 0];
        const m = machineById.get(next[idx].id)!;
        const span = (temp / startTemp) * Math.max(floor.w, floor.h) * 0.5;
        const np = {
          x: next[idx].pos.x + (rand() * 2 - 1) * (span + 0.5),
          y: next[idx].pos.y + (rand() * 2 - 1) * (span + 0.5),
        };
        next[idx].pos = clampPos({ ...m, rotationDeg: next[idx].rot }, np, floor);
      } else if (roll < mw.translate + mw.rotate) {
        const idx = movableIdx[(rand() * movableIdx.length) | 0];
        const m = machineById.get(next[idx].id)!;
        next[idx].rot = (((next[idx].rot + 90) % 360) as 0 | 90 | 180 | 270);
        next[idx].pos = clampPos(
          { ...m, rotationDeg: next[idx].rot },
          next[idx].pos,
          floor
        );
      } else {
        // swap two machines' positions
        const a = movableIdx[(rand() * movableIdx.length) | 0];
        let b = movableIdx[(rand() * movableIdx.length) | 0];
        if (a === b) b = movableIdx[(a + 1) % movableIdx.length];
        const tmp = next[a].pos;
        next[a].pos = next[b].pos;
        next[b].pos = tmp;
      }

      const e = energy(project, next);
      const delta = e - current;
      if (delta < 0 || rand() < Math.exp(-delta / Math.max(1e-6, temp))) {
        state = next;
        current = e;
        if (e < best) {
          best = e;
          bestState = next.map((s) => ({ ...s, pos: { ...s.pos } }));
        }
      }
    }

    if (i % progressEvery === 0 && onProgress) {
      onProgress({
        iteration: i,
        total: 100 - current,
        bestTotal: 100 - best,
        bestPlacements: placementsFrom(bestState),
      });
    }
  }

  const placements = placementsFrom(bestState);
  return {
    placements,
    score: scoreLayout(project, placements),
    iterations,
  };
}

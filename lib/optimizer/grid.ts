import type { LayoutProject, Machine, Vec2 } from "@/lib/types";
import { bbox, machineFootprintRect, type Rect } from "@/lib/geometry";
import { pointInPolygon } from "@/lib/geometry";

/**
 * A discretized cost grid over the floor, shared by routing and the flow
 * heatmap. Cells outside the boundary or inside obstacles / no-go zones are
 * hard-blocked (cost = Infinity). Machine footprints are soft-blocked with a
 * traversal penalty so routes prefer aisles but never become impossible.
 */
export interface CostGrid {
  origin: Vec2; // top-left in meters
  cell: number; // meters per cell
  cols: number;
  rows: number;
  cost: Float64Array; // per-cell traversal cost; Infinity = blocked
}

export interface BuildGridOptions {
  /** Penalty added to cells covered by a machine footprint. */
  machinePenalty?: number;
  /** Hard-block machine footprints (cost = Infinity) instead of penalizing.
   *  Used for worker-walkability / reachability analysis. */
  blockMachines?: boolean;
  /** Override the grid cell size (meters). Defaults to floor.gridResolution. */
  cell?: number;
}

export function buildCostGrid(
  project: LayoutProject,
  opts: BuildGridOptions = {}
): CostGrid {
  const b = bbox(project.floor.boundary);
  const cell = Math.max(0.25, opts.cell ?? project.floor.gridResolution);
  const cols = Math.max(1, Math.ceil(b.w / cell));
  const rows = Math.max(1, Math.ceil(b.h / cell));
  const cost = new Float64Array(cols * rows).fill(1);

  const hardBlocks: Rect[] = [
    ...project.floor.obstacles.map((o) => bbox(o.polygon)),
    ...project.safetyRules
      .filter((r) => r.kind === "no_go_zone" && r.zone)
      .map((r) => bbox(r.zone!)),
  ];

  const machineRects: Rect[] = project.machines
    .filter((m) => m.pos)
    .map((m) => machineFootprintRect(m, m.pos!, false));
  const machinePenalty = opts.machinePenalty ?? 8;

  const center = (cx: number, cy: number): Vec2 => ({
    x: b.x + (cx + 0.5) * cell,
    y: b.y + (cy + 0.5) * cell,
  });

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const p = center(cx, cy);
      const i = cy * cols + cx;
      if (!pointInPolygon(p, project.floor.boundary)) {
        cost[i] = Infinity;
        continue;
      }
      let blocked = false;
      for (const r of hardBlocks) {
        if (inRect(p, r)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        cost[i] = Infinity;
        continue;
      }
      for (const r of machineRects) {
        if (inRect(p, r)) {
          if (opts.blockMachines) cost[i] = Infinity;
          else cost[i] += machinePenalty;
          break;
        }
      }
    }
  }

  return { origin: { x: b.x, y: b.y }, cell, cols, rows, cost };
}

function inRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function worldToCell(
  grid: CostGrid,
  p: Vec2
): { cx: number; cy: number } {
  return {
    cx: clampInt((p.x - grid.origin.x) / grid.cell, grid.cols),
    cy: clampInt((p.y - grid.origin.y) / grid.cell, grid.rows),
  };
}

export function cellToWorld(grid: CostGrid, cx: number, cy: number): Vec2 {
  return {
    x: grid.origin.x + (cx + 0.5) * grid.cell,
    y: grid.origin.y + (cy + 0.5) * grid.cell,
  };
}

function clampInt(v: number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(v)));
}

/** Convenience accessor for the rectangle a machine occupies (no clearance). */
export function machineCells(grid: CostGrid, m: Machine): number[] {
  if (!m.pos) return [];
  const out: number[] = [];
  const r = machineFootprintRect(m, m.pos, false);
  const x0 = clampInt((r.x - grid.origin.x) / grid.cell, grid.cols);
  const y0 = clampInt((r.y - grid.origin.y) / grid.cell, grid.rows);
  const x1 = clampInt((r.x + r.w - grid.origin.x) / grid.cell, grid.cols);
  const y1 = clampInt((r.y + r.h - grid.origin.y) / grid.cell, grid.rows);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) out.push(cy * grid.cols + cx);
  return out;
}

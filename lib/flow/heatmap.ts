import type { LayoutProject, Vec2 } from "@/lib/types";
import { machineCenter } from "@/lib/geometry";
import { buildCostGrid, worldToCell, type CostGrid } from "@/lib/optimizer/grid";
import { routeCells } from "./routing";

/**
 * A discretized scalar field over the floor used to render the material-flow
 * heatmap. `values` is row-major (rows × cols). This is a transparent,
 * heuristic flow model: it routes each material flow between connected
 * machines with A* around walls, obstacles, and (softly) other machines, then
 * accumulates throughput along the cells each route crosses. It is NOT a
 * neural/CFD physics solver — it is an explainable, obstacle-aware routing
 * model that surfaces congested aisles.
 */
export interface HeatmapField {
  origin: Vec2; // top-left in meters
  cell: number; // meters per cell
  cols: number;
  rows: number;
  values: number[];
  max: number;
  /** Total routed transport work: Σ unitsPerDay × routed-distance (meters). */
  routedWork: number;
}

export function computeFlowHeatmap(project: LayoutProject): HeatmapField {
  const grid = buildCostGrid(project, { machinePenalty: 8 });
  return heatmapFromGrid(project, grid);
}

function heatmapFromGrid(project: LayoutProject, grid: CostGrid): HeatmapField {
  const { cols, rows, cell, origin } = grid;
  const values = new Array(cols * rows).fill(0);
  const byId = new Map(project.machines.map((m) => [m.id, m]));
  let routedWork = 0;

  for (const f of project.flows) {
    const a = byId.get(f.from);
    const c = byId.get(f.to);
    if (!a?.pos || !c?.pos) continue;
    const ca = machineCenter(a);
    const cc = machineCenter(c);
    if (!ca || !cc) continue;

    const s = worldToCell(grid, ca);
    const e = worldToCell(grid, cc);
    const startIdx = s.cy * cols + s.cx;
    const goalIdx = e.cy * cols + e.cx;

    const route = routeCells(grid, startIdx, goalIdx);
    const path =
      route.cells.length > 0
        ? route.cells
        : straightFallback(s, e, cols, rows);

    for (const idx of path) values[idx] += f.unitsPerDay;
    // routed distance in meters: A* reports it directly; the fallback counts
    // path segments (cells - 1), matching A*'s (cells-1)×cell convention.
    const len =
      route.cells.length > 0
        ? route.length
        : Math.max(0, path.length - 1) * cell;
    routedWork += f.unitsPerDay * len;
  }

  let max = 0;
  for (const v of values) if (v > max) max = v;

  return {
    origin,
    cell,
    cols,
    rows,
    values,
    max,
    routedWork: Math.round(routedWork),
  };
}

/** L-shaped fallback if A* finds no route (e.g. fully walled-in machine). */
function straightFallback(
  s: { cx: number; cy: number },
  e: { cx: number; cy: number },
  cols: number,
  rows: number
): number[] {
  const out: number[] = [];
  const stepX = Math.sign(e.cx - s.cx) || 1;
  for (let x = s.cx; ; x += stepX) {
    out.push(s.cy * cols + clamp(x, cols));
    if (x === e.cx) break;
  }
  // start the vertical leg one step in to avoid double-counting the corner
  // cell (e.cx, s.cy) already pushed by the horizontal leg.
  const stepY = Math.sign(e.cy - s.cy) || 1;
  if (s.cy !== e.cy) {
    for (let y = s.cy + stepY; ; y += stepY) {
      out.push(clamp(y, rows) * cols + e.cx);
      if (y === e.cy) break;
    }
  }
  return out;
}

function clamp(v: number, n: number) {
  return Math.min(n - 1, Math.max(0, v));
}

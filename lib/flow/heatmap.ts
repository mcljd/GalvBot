import type { LayoutProject, Vec2 } from "@/lib/types";
import { bbox, machineCenter } from "@/lib/geometry";

/**
 * A discretized scalar field over the floor used to render the material-flow
 * heatmap. `values` is row-major (rows × cols). This is a transparent,
 * heuristic flow model — it traces L-shaped (Manhattan) routes between
 * connected machines and accumulates throughput along the cells they cross.
 * It is NOT a neural/CFD physics solver.
 */
export interface HeatmapField {
  origin: Vec2; // top-left in meters
  cell: number; // meters per cell
  cols: number;
  rows: number;
  values: number[];
  max: number;
}

export function computeFlowHeatmap(project: LayoutProject): HeatmapField {
  const b = bbox(project.floor.boundary);
  const cell = Math.max(project.floor.gridResolution, 0.25);
  const cols = Math.max(1, Math.ceil(b.w / cell));
  const rows = Math.max(1, Math.ceil(b.h / cell));
  const values = new Array(cols * rows).fill(0);

  const toCell = (p: Vec2) => ({
    cx: Math.min(cols - 1, Math.max(0, Math.floor((p.x - b.x) / cell))),
    cy: Math.min(rows - 1, Math.max(0, Math.floor((p.y - b.y) / cell))),
  });

  const byId = new Map(project.machines.map((m) => [m.id, m]));

  for (const f of project.flows) {
    const a = byId.get(f.from);
    const c = byId.get(f.to);
    if (!a?.pos || !c?.pos) continue;
    const ca = machineCenter(a);
    const cc = machineCenter(c);
    if (!ca || !cc) continue;
    const s = toCell(ca);
    const e = toCell(cc);

    // L-shaped Manhattan route: horizontal leg then vertical leg.
    const w = f.unitsPerDay;
    const stepX = Math.sign(e.cx - s.cx) || 1;
    for (let x = s.cx; x !== e.cx + stepX; x += stepX) {
      values[s.cy * cols + x] += w;
      if (x === e.cx) break;
    }
    const stepY = Math.sign(e.cy - s.cy) || 1;
    for (let y = s.cy; y !== e.cy + stepY; y += stepY) {
      values[y * cols + e.cx] += w;
      if (y === e.cy) break;
    }
  }

  let max = 0;
  for (const v of values) if (v > max) max = v;

  return { origin: { x: b.x, y: b.y }, cell, cols, rows, values, max };
}

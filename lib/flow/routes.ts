import type { LayoutProject, Vec2 } from "@/lib/types";
import { machineCenter } from "@/lib/geometry";
import { buildCostGrid, worldToCell, cellToWorld } from "@/lib/optimizer/grid";
import { routeCells } from "./routing";

export interface FlowRoute {
  from: string;
  to: string;
  unitsPerDay: number;
  /** Polyline of the routed path in meters (empty if unreachable). */
  points: Vec2[];
  length: number;
}

/**
 * Computes the obstacle-aware A* route for every flow edge as a polyline — the
 * "spaghetti diagram" a layout consultant draws to show how parts actually
 * travel around the floor.
 */
export function computeFlowRoutes(project: LayoutProject): FlowRoute[] {
  const grid = buildCostGrid(project, { machinePenalty: 8 });
  const byId = new Map(project.machines.map((m) => [m.id, m]));
  const out: FlowRoute[] = [];

  for (const f of project.flows) {
    const a = byId.get(f.from);
    const b = byId.get(f.to);
    if (!a?.pos || !b?.pos) continue;
    const ca = machineCenter(a);
    const cb = machineCenter(b);
    if (!ca || !cb) continue;
    const s = worldToCell(grid, ca);
    const e = worldToCell(grid, cb);
    const route = routeCells(grid, s.cy * grid.cols + s.cx, e.cy * grid.cols + e.cx);
    const points =
      route.cells.length > 0
        ? simplify(route.cells.map((c) => cellToWorld(grid, c % grid.cols, (c / grid.cols) | 0)))
        : [ca, cb];
    out.push({
      from: f.from,
      to: f.to,
      unitsPerDay: f.unitsPerDay,
      points,
      length: route.length,
    });
  }
  return out;
}

/** Collapse collinear runs so the polyline is light to render. */
function simplify(pts: Vec2[]): Vec2[] {
  if (pts.length <= 2) return pts;
  const out: Vec2[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const collinear =
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) === 0;
    if (!collinear) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

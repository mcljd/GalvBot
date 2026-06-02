import type { LayoutProject, Vec2 } from "@/lib/types";
import { machineFootprintRect } from "@/lib/geometry";
import {
  buildCostGrid,
  worldToCell,
  type CostGrid,
} from "@/lib/optimizer/grid";
import { routeCells } from "@/lib/flow/routing";

/**
 * Egress & aisle compliance engine. This is an explainable, geometry-based
 * advisory check — NOT a stamped code determination. It models real concepts:
 *   - continuous corridor width via a distance transform (not machine-pair gaps)
 *   - shortest walking route from each machine to the nearest egress door
 *   - travel-distance-to-exit and number-of-exits checks
 * Defaults approximate common life-safety expectations (IBC/NFPA-flavored) but
 * the user/AHJ must verify against the governing code.
 */
export interface EgressStandard {
  /** Minimum clear pedestrian aisle/corridor width (m). ~1.12 m = 44 in. */
  minAisleWidth: number;
  /** Max permitted travel distance to an exit (m). ~61 m sprinklered. */
  maxTravelDistance: number;
  /** Minimum number of egress doors. */
  minExits: number;
}

export const DEFAULT_EGRESS_STANDARD: EgressStandard = {
  minAisleWidth: 1.12,
  maxTravelDistance: 61,
  minExits: 2,
};

export interface MachineEgress {
  id: string;
  label: string;
  reachable: boolean;
  travelDistance: number; // meters to nearest exit (Infinity if unreachable)
  minAisleWidth: number; // narrowest corridor width along that route (m)
}

export interface ComplianceReport {
  exitCount: number;
  machines: MachineEgress[];
  narrowestAisle: number; // min corridor width across all egress routes
  maxTravelDistance: number; // worst machine travel distance
  violations: { ruleId: string; message: string; severity: "warn" | "error" }[];
  standard: EgressStandard;
  /** False when no exits are defined (results then use a degraded fallback). */
  exitsDefined: boolean;
}

/**
 * Chamfer distance transform: distance (meters) from each walkable cell to the
 * nearest blocked cell (wall/obstacle/no-go/machine). Corridor width at a cell
 * ≈ 2× this distance.
 */
export function distanceTransform(grid: CostGrid): Float64Array {
  const { cols, rows, cost, cell } = grid;
  const n = cols * rows;
  const D = new Float64Array(n);
  const INF = 1e9;
  for (let i = 0; i < n; i++) D[i] = Number.isFinite(cost[i]) ? INF : 0;

  // The grid spans exactly the floor, so its outer edge IS the boundary wall.
  // Seed border cells at half a cell from that wall so clearance shrinks near
  // the perimeter.
  for (let x = 0; x < cols; x++) {
    D[x] = Math.min(D[x], 0.5);
    D[(rows - 1) * cols + x] = Math.min(D[(rows - 1) * cols + x], 0.5);
  }
  for (let y = 0; y < rows; y++) {
    D[y * cols] = Math.min(D[y * cols], 0.5);
    D[y * cols + cols - 1] = Math.min(D[y * cols + cols - 1], 0.5);
  }

  const d1 = 1;
  const d2 = Math.SQRT2;
  const at = (x: number, y: number) => y * cols + x;

  // forward pass
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = at(x, y);
      if (D[i] === 0) continue;
      let m = D[i];
      if (x > 0) m = Math.min(m, D[at(x - 1, y)] + d1);
      if (y > 0) m = Math.min(m, D[at(x, y - 1)] + d1);
      if (x > 0 && y > 0) m = Math.min(m, D[at(x - 1, y - 1)] + d2);
      if (x < cols - 1 && y > 0) m = Math.min(m, D[at(x + 1, y - 1)] + d2);
      D[i] = m;
    }
  }
  // backward pass
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      const i = at(x, y);
      if (D[i] === 0) continue;
      let m = D[i];
      if (x < cols - 1) m = Math.min(m, D[at(x + 1, y)] + d1);
      if (y < rows - 1) m = Math.min(m, D[at(x, y + 1)] + d1);
      if (x < cols - 1 && y < rows - 1) m = Math.min(m, D[at(x + 1, y + 1)] + d2);
      if (x > 0 && y < rows - 1) m = Math.min(m, D[at(x - 1, y + 1)] + d2);
      D[i] = m;
    }
  }

  for (let i = 0; i < n; i++) D[i] *= cell;
  return D;
}

/** Nearest walkable (finite-cost) cell to a world point, searching outward. */
function nearestWalkable(grid: CostGrid, p: Vec2): number | null {
  const { cols, rows, cost } = grid;
  const { cx, cy } = worldToCell(grid, p);
  for (let r = 0; r <= Math.max(cols, rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const i = ny * cols + nx;
        if (Number.isFinite(cost[i])) return i;
      }
    }
  }
  return null;
}

export function computeCompliance(
  project: LayoutProject,
  standard: EgressStandard = DEFAULT_EGRESS_STANDARD
): ComplianceReport {
  // Walking grid: machines are solid; outside/obstacle/no-go are blocked.
  const grid = buildCostGrid(project, { blockMachines: true });
  const D = distanceTransform(grid);

  const exitsDefined = (project.floor.exits?.length ?? 0) > 0;
  // Fallback to outbound docks if no dedicated exits are defined yet.
  const exitPoints: Vec2[] = exitsDefined
    ? project.floor.exits!.map((e) => e.pos)
    : project.floor.docks.map((d) => d.pos);

  const exitCells = exitPoints
    .map((p) => nearestWalkable(grid, p))
    .filter((c): c is number => c !== null);

  const machines: MachineEgress[] = [];
  for (const m of project.machines) {
    if (!m.pos) continue;
    // start from a walkable cell just outside the machine footprint
    const rect = machineFootprintRect(m, m.pos, false);
    const start = nearestWalkable(grid, {
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    });
    if (start === null || exitCells.length === 0) {
      machines.push({
        id: m.id,
        label: m.label,
        reachable: false,
        travelDistance: Infinity,
        minAisleWidth: 0,
      });
      continue;
    }
    // Ignore the unavoidable approach right beside the machine and the exit
    // door when measuring corridor width — those endpoints are intentionally
    // tight; we care about pinch points along the aisle itself.
    const skip = Math.ceil(Math.max(1, standard.minAisleWidth) / grid.cell);
    let best: { dist: number; width: number } | null = null;
    for (const ex of exitCells) {
      const route = routeCells(grid, start, ex);
      if (route.cells.length === 0) continue;
      let minW = Infinity;
      for (let k = 0; k < route.cells.length; k++) {
        if (k < skip || k >= route.cells.length - skip) continue;
        minW = Math.min(minW, 2 * D[route.cells[k]]);
      }
      // very short route (machine essentially at the exit): treat as clear
      if (!Number.isFinite(minW)) minW = 2 * (standard.minAisleWidth + 1);
      if (!best || route.length < best.dist)
        best = { dist: route.length, width: minW };
    }
    machines.push({
      id: m.id,
      label: m.label,
      reachable: best !== null,
      travelDistance: best ? best.dist : Infinity,
      minAisleWidth: best ? Math.round(best.width * 100) / 100 : 0,
    });
  }

  const reachable = machines.filter((m) => m.reachable);
  const narrowestAisle = reachable.length
    ? Math.min(...reachable.map((m) => m.minAisleWidth))
    : 0;
  const maxTravel = reachable.length
    ? Math.max(...reachable.map((m) => m.travelDistance))
    : 0;

  const violations: ComplianceReport["violations"] = [];
  if (!exitsDefined) {
    violations.push({
      ruleId: "exits",
      severity: "warn",
      message:
        "No dedicated fire exits defined — using dock locations as a proxy. Add exits for an accurate egress check.",
    });
  }
  if (exitCells.length < standard.minExits) {
    violations.push({
      ruleId: "exits",
      severity: "error",
      message: `Only ${exitCells.length} egress door(s); at least ${standard.minExits} are typically required.`,
    });
  }
  for (const m of machines) {
    if (!m.reachable) {
      violations.push({
        ruleId: "egress",
        severity: "error",
        message: `${m.label} has no walkable route to an exit.`,
      });
      continue;
    }
    if (m.minAisleWidth < standard.minAisleWidth) {
      violations.push({
        ruleId: "aisle",
        severity: "warn",
        message: `Egress route from ${m.label} narrows to ${m.minAisleWidth.toFixed(
          2
        )} m (min ${standard.minAisleWidth} m).`,
      });
    }
    if (m.travelDistance > standard.maxTravelDistance) {
      violations.push({
        ruleId: "travel",
        severity: "warn",
        message: `${m.label} is ${m.travelDistance.toFixed(
          0
        )} m from an exit (max ${standard.maxTravelDistance} m).`,
      });
    }
  }

  return {
    exitCount: exitCells.length,
    machines,
    narrowestAisle: Math.round(narrowestAisle * 100) / 100,
    maxTravelDistance: Math.round(maxTravel * 10) / 10,
    violations,
    standard,
    exitsDefined,
  };
}

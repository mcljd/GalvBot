import type { LayoutProject, MachineType, Vec2 } from "@/lib/types";
import { MACHINE_META } from "@/lib/types";
import {
  bbox,
  machineFootprintRect,
  polygonArea,
  rotatedFootprint,
} from "@/lib/geometry";
import { buildCostGrid, worldToCell, type CostGrid } from "@/lib/optimizer/grid";
import { computeFlowHeatmap } from "@/lib/flow/heatmap";

export interface LayoutAnalytics {
  machineCount: number;
  byType: Partial<Record<MachineType, number>>;
  totalPowerKw: number;
  footprintArea: number; // m²
  usableFloorArea: number; // m² (floor minus obstacles)
  utilizationPct: number; // footprint / usable × 100
  totalThroughput: number; // units/day
  routedWork: number; // Σ units × routed distance
  highHeatCount: number;
  /** Machine ids that cannot be reached on foot from any inbound dock. */
  unreachable: string[];
  /** Whether reachability was evaluated (requires an inbound dock). */
  reachabilityChecked: boolean;
}

export function computeAnalytics(project: LayoutProject): LayoutAnalytics {
  const placed = project.machines.filter((m) => m.pos);

  const byType: Partial<Record<MachineType, number>> = {};
  let totalPowerKw = 0;
  let footprintArea = 0;
  let highHeatCount = 0;
  for (const m of project.machines) {
    byType[m.type] = (byType[m.type] ?? 0) + 1;
    totalPowerKw += m.powerKw ?? MACHINE_META[m.type].defaultPowerKw;
    const f = rotatedFootprint(m);
    footprintArea += f.w * f.d;
    if (m.heatOutput === "high") highHeatCount++;
  }

  const floorArea = polygonArea(project.floor.boundary);
  const obstacleArea = project.floor.obstacles.reduce(
    (s, o) => s + polygonArea(o.polygon),
    0
  );
  const usableFloorArea = Math.max(1e-6, floorArea - obstacleArea);

  const field = computeFlowHeatmap(project);
  const totalThroughput = project.flows.reduce(
    (s, f) => s + f.unitsPerDay,
    0
  );

  const { unreachable, checked } = reachabilityFromDocks(project);

  return {
    machineCount: placed.length,
    byType,
    totalPowerKw: Math.round(totalPowerKw * 10) / 10,
    footprintArea: Math.round(footprintArea * 10) / 10,
    usableFloorArea: Math.round(usableFloorArea * 10) / 10,
    utilizationPct: Math.round((footprintArea / usableFloorArea) * 1000) / 10,
    totalThroughput,
    routedWork: field.routedWork,
    highHeatCount,
    unreachable,
    reachabilityChecked: checked,
  };
}

/**
 * Flood-fill walkable cells from every inbound dock (machines hard-blocked),
 * then flag machines whose footprint isn't touched by the reachable region.
 */
function reachabilityFromDocks(project: LayoutProject): {
  unreachable: string[];
  checked: boolean;
} {
  const inbound = project.floor.docks.filter((d) => d.type === "inbound");
  if (inbound.length === 0) return { unreachable: [], checked: false };

  const grid = buildCostGrid(project, { blockMachines: true });
  const { cols, rows, cost } = grid;
  const visited = new Uint8Array(cols * rows);
  const queue: number[] = [];

  const seed = (p: Vec2) => {
    const { cx, cy } = worldToCell(grid, p);
    // dock sits on the boundary edge; nudge inward to the first walkable cell
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const i = ny * cols + nx;
      if (Number.isFinite(cost[i]) && !visited[i]) {
        visited[i] = 1;
        queue.push(i);
      }
    }
  };
  for (const d of inbound) seed(d.pos);

  while (queue.length) {
    const cur = queue.pop()!;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    const nbs = [
      cx > 0 ? cur - 1 : -1,
      cx < cols - 1 ? cur + 1 : -1,
      cy > 0 ? cur - cols : -1,
      cy < rows - 1 ? cur + cols : -1,
    ];
    for (const nb of nbs) {
      if (nb < 0 || visited[nb] || !Number.isFinite(cost[nb])) continue;
      visited[nb] = 1;
      queue.push(nb);
    }
  }

  const unreachable: string[] = [];
  for (const m of project.machines) {
    if (!m.pos) continue;
    if (!isMachineReached(grid, m, visited)) unreachable.push(m.id);
  }
  return { unreachable, checked: true };
}

function isMachineReached(
  grid: CostGrid,
  m: { pos?: Vec2; footprint: { w: number; d: number }; rotationDeg?: 0 | 90 | 180 | 270 },
  visited: Uint8Array
): boolean {
  if (!m.pos) return false;
  const rect = machineFootprintRect(m as never, m.pos, false);
  const b = bbox([
    { x: rect.x - grid.cell, y: rect.y - grid.cell },
    { x: rect.x + rect.w + grid.cell, y: rect.y + rect.h + grid.cell },
  ]);
  const start = worldToCell(grid, { x: b.x, y: b.y });
  const end = worldToCell(grid, { x: b.x + b.w, y: b.y + b.h });
  for (let cy = start.cy; cy <= end.cy; cy++) {
    for (let cx = start.cx; cx <= end.cx; cx++) {
      if (visited[cy * grid.cols + cx]) return true;
    }
  }
  return false;
}

import type {
  LayoutProject,
  LayoutScore,
  Machine,
  Placement,
  Violation,
} from "@/lib/types";
import {
  bbox,
  machineCenter,
  machineFootprintRect,
  manhattan,
  overlapArea,
  rectDistance,
  rectsOverlap,
  polygonArea,
  type Rect,
} from "@/lib/geometry";

/**
 * Transparent, explainable layout scoring. Each pillar is normalized to 0..100
 * (higher = better) and combined with the project's objective weights into a
 * composite `total`. Hard problems (overlaps, out-of-bounds, no-go intrusions)
 * surface as `error` violations and heavily penalize the safety pillar.
 */

export interface ScoreContext {
  machines: Machine[];
  floorBox: Rect;
}

/** Apply optional optimizer placements over the project's machines. */
export function effectiveMachines(
  project: LayoutProject,
  placements?: Placement[]
): Machine[] {
  if (!placements) return project.machines;
  const map = new Map(placements.map((p) => [p.machineId, p]));
  return project.machines.map((m) => {
    const p = map.get(m.id);
    return p ? { ...m, pos: p.pos, rotationDeg: p.rotationDeg } : m;
  });
}

function clamp100(v: number) {
  return Math.max(0, Math.min(100, v));
}

/** Sum of throughput-weighted Manhattan transport distance (lower = better). */
export function flowCost(
  project: LayoutProject,
  machines: Machine[]
): number {
  const byId = new Map(machines.map((m) => [m.id, m]));
  let cost = 0;
  for (const f of project.flows) {
    const a = byId.get(f.from);
    const b = byId.get(f.to);
    if (!a?.pos || !b?.pos) continue;
    const ca = machineCenter(a);
    const cb = machineCenter(b);
    if (!ca || !cb) continue;
    cost += f.unitsPerDay * manhattan(ca, cb);
  }
  return cost;
}

function materialFlowScore(
  project: LayoutProject,
  machines: Machine[],
  floorBox: Rect
): number {
  const totalUnits = project.flows.reduce((s, f) => s + f.unitsPerDay, 0);
  if (totalUnits === 0) return 100;
  const worst = totalUnits * (floorBox.w + floorBox.h); // max manhattan span
  if (worst <= 0) return 100;
  const cost = flowCost(project, machines);
  return clamp100(100 * (1 - cost / worst));
}

/** Collect every safety/feasibility violation for the given machine set. */
export function collectViolations(
  project: LayoutProject,
  machines: Machine[],
  floorBox: Rect
): Violation[] {
  const out: Violation[] = [];
  const placed = machines.filter((m) => m.pos);
  const rects = placed.map((m) => ({
    m,
    rect: machineFootprintRect(m, m.pos!, false),
  }));

  // machine–machine overlaps (hard)
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (overlapArea(rects[i].rect, rects[j].rect) > 1e-6) {
        out.push({
          ruleId: "overlap",
          severity: "error",
          message: `${rects[i].m.label} overlaps ${rects[j].m.label}`,
        });
      }
    }
  }

  // out of bounds (hard)
  for (const { m, rect } of rects) {
    if (
      rect.x < floorBox.x - 1e-6 ||
      rect.y < floorBox.y - 1e-6 ||
      rect.x + rect.w > floorBox.x + floorBox.w + 1e-6 ||
      rect.y + rect.h > floorBox.y + floorBox.h + 1e-6
    ) {
      out.push({
        ruleId: "bounds",
        severity: "error",
        message: `${m.label} extends outside the floor boundary`,
      });
    }
  }

  // obstacle overlaps (hard)
  for (const o of project.floor.obstacles) {
    const ob = bbox(o.polygon);
    for (const { m, rect } of rects) {
      if (rectsOverlap(rect, ob)) {
        out.push({
          ruleId: "obstacle",
          severity: "error",
          message: `${m.label} collides with ${o.label ?? "an obstacle"}`,
        });
      }
    }
  }

  for (const rule of project.safetyRules) {
    if (rule.kind === "no_go_zone" && rule.zone) {
      const zb = bbox(rule.zone);
      for (const { m, rect } of rects) {
        if (rectsOverlap(rect, zb)) {
          out.push({
            ruleId: rule.id,
            severity: "error",
            message: `${m.label} is inside a no-go zone`,
          });
        }
      }
    } else if (rule.kind === "min_aisle_width" && rule.value) {
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const d = rectDistance(rects[i].rect, rects[j].rect);
          if (d > 1e-6 && d < rule.value) {
            out.push({
              ruleId: rule.id,
              severity: "warn",
              message: `Aisle between ${rects[i].m.label} and ${rects[j].m.label} is ${d.toFixed(
                2
              )} m (< ${rule.value} m)`,
            });
          }
        }
      }
    } else if (rule.kind === "exit_clearance" && rule.value) {
      for (const dock of project.floor.docks) {
        const dockRect: Rect = {
          x: dock.pos.x - 0.05,
          y: dock.pos.y - 0.05,
          w: 0.1,
          h: 0.1,
        };
        for (const { m, rect } of rects) {
          if (rectDistance(rect, dockRect) < rule.value) {
            out.push({
              ruleId: rule.id,
              severity: "error",
              message: `${m.label} blocks exit clearance at ${dock.type} dock`,
            });
          }
        }
      }
    } else if (rule.kind === "heat_separation" && rule.value) {
      const hot = rects.filter((r) => r.m.heatOutput === "high");
      for (let i = 0; i < hot.length; i++) {
        for (let j = i + 1; j < hot.length; j++) {
          const d = rectDistance(hot[i].rect, hot[j].rect);
          if (d < rule.value) {
            out.push({
              ruleId: rule.id,
              severity: "error",
              message: `High-heat ${hot[i].m.label} and ${hot[j].m.label} are ${d.toFixed(
                2
              )} m apart (< ${rule.value} m)`,
            });
          }
        }
      }
    }
  }

  return out;
}

function safetyScore(violations: Violation[]): number {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warns = violations.filter((v) => v.severity === "warn").length;
  return clamp100(100 - errors * 14 - warns * 5);
}

/** Packing efficiency + clearance satisfaction. */
function utilizationScore(
  project: LayoutProject,
  machines: Machine[]
): number {
  const placed = machines.filter((m) => m.pos);
  if (placed.length === 0) return 100;

  const rects = placed.map((m) => ({
    m,
    rect: machineFootprintRect(m, m.pos!, false),
    halo: machineFootprintRect(m, m.pos!, true),
  }));

  // clearance satisfaction: a machine's clearance halo should not be invaded by
  // another machine's footprint.
  let satisfied = 0;
  for (let i = 0; i < rects.length; i++) {
    let ok = true;
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue;
      if (overlapArea(rects[i].halo, rects[j].rect) > 1e-6) {
        ok = false;
        break;
      }
    }
    if (ok) satisfied++;
  }
  const clearanceScore = (satisfied / rects.length) * 100;

  // packing efficiency: footprint area / cluster bounding-box area
  const footprintArea = rects.reduce((s, r) => s + r.rect.w * r.rect.h, 0);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const { rect } of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  const clusterArea = Math.max(1e-6, (maxX - minX) * (maxY - minY));
  const packing = clamp100((footprintArea / clusterArea) * 100);

  return clamp100(0.6 * clearanceScore + 0.4 * packing);
}

function usableFloorArea(project: LayoutProject): number {
  const floor = polygonArea(project.floor.boundary);
  const obstacles = project.floor.obstacles.reduce(
    (s, o) => s + polygonArea(o.polygon),
    0
  );
  return Math.max(1e-6, floor - obstacles);
}

export function scoreLayout(
  project: LayoutProject,
  placements?: Placement[]
): LayoutScore {
  const machines = effectiveMachines(project, placements);
  const floorBox = bbox(project.floor.boundary);

  const materialFlow = materialFlowScore(project, machines, floorBox);
  const violations = collectViolations(project, machines, floorBox);
  const safety = safetyScore(violations);
  const utilization = utilizationScore(project, machines);

  // normalize weights
  const w = project.weights;
  const sum = w.materialFlow + w.safety + w.utilization || 1;
  const total =
    (materialFlow * w.materialFlow +
      safety * w.safety +
      utilization * w.utilization) /
    sum;

  return {
    total: Math.round(total * 10) / 10,
    materialFlow: Math.round(materialFlow * 10) / 10,
    safety: Math.round(safety * 10) / 10,
    utilization: Math.round(utilization * 10) / 10,
    violations,
  };
}

/** Convenience: does this machine set contain any hard (error) violation? */
export function isFeasible(project: LayoutProject, placements?: Placement[]) {
  const machines = effectiveMachines(project, placements);
  const floorBox = bbox(project.floor.boundary);
  return !collectViolations(project, machines, floorBox).some(
    (v) => v.severity === "error"
  );
}

export { usableFloorArea };

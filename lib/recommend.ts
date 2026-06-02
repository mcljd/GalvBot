import type { LayoutProject, Machine, Vec2 } from "@/lib/types";
import { MACHINE_META } from "@/lib/types";
import { rotatedFootprint, bbox } from "@/lib/geometry";
import { scoreLayout } from "@/lib/optimizer/scoring";
import { computeBusinessCase } from "@/lib/economics";
import { computeCompliance } from "@/lib/compliance";

export type SuggestionKind = "flow" | "capacity" | "safety" | "egress";

export interface Suggestion {
  kind: SuggestionKind;
  title: string;
  detail: string;
  /** Composite-score improvement this suggestion would unlock (0 if n/a). */
  gain: number;
  /** Machine to highlight when the user clicks the suggestion. */
  machineId?: string;
  /** One-click apply target for relocation suggestions. */
  move?: { machineId: string; pos: Vec2 };
}

/**
 * Generates a ranked, explainable list of "what should I change" suggestions by
 * reusing the scoring, economics and compliance engines. Relocation ideas are
 * validated by actually trial-placing a machine and re-scoring, so every
 * suggested move reports its real composite-score gain.
 */
export function generateSuggestions(
  project: LayoutProject,
  maxRelocations = 3
): Suggestion[] {
  const out: Suggestion[] = [];

  // 1. Flow-driven relocations: for the highest-throughput edges, try moving a
  //    movable endpoint adjacent to its partner and keep moves that score better.
  const byId = new Map(project.machines.map((m) => [m.id, m]));
  const edges = [...project.flows].sort((a, b) => b.unitsPerDay - a.unitsPerDay);
  const seen = new Set<string>();
  const relocations: Suggestion[] = [];

  for (const e of edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from?.pos || !to?.pos) continue;
    // choose the movable machine to relocate next to the other
    const mover = !from.fixed ? from : !to.fixed ? to : null;
    const anchor = mover === from ? to : from;
    if (!mover || seen.has(mover.id)) continue;

    const best = bestAdjacentPlacement(project, mover, anchor);
    if (best && best.gain > 0.8) {
      seen.add(mover.id);
      relocations.push({
        kind: "flow",
        title: `Move ${mover.label} next to ${anchor.label}`,
        detail: `They exchange ${e.unitsPerDay} units/day — relocating cuts transport and lifts the score ~${best.gain.toFixed(
          1
        )} pts.`,
        gain: best.gain,
        machineId: mover.id,
        move: { machineId: mover.id, pos: best.pos },
      });
    }
    if (relocations.length >= maxRelocations) break;
  }
  relocations.sort((a, b) => b.gain - a.gain);
  out.push(...relocations);

  // 2. Capacity / bottleneck.
  const bc = computeBusinessCase(project);
  for (const s of bc.overCapacity.slice(0, 2)) {
    const m = byId.get(s.id);
    out.push({
      kind: "capacity",
      title: `Add capacity at ${s.label}`,
      detail: `Demand is ${Math.round(
        s.utilization * 100
      )}% of capacity (${s.load}/${s.capacity}/day). Add a parallel ${
        m ? MACHINE_META[m.type].label : "unit"
      } or rebalance flow.`,
      gain: 0,
      machineId: s.id,
    });
  }

  // 3. Egress compliance.
  const comp = computeCompliance(project);
  if (comp.exitCount < comp.standard.minExits) {
    out.push({
      kind: "egress",
      title: "Add emergency exits",
      detail: `Only ${comp.exitCount} egress door(s); target is ≥ ${comp.standard.minExits}. Use the Place-exit tool on the boundary.`,
      gain: 0,
    });
  }
  for (const m of comp.machines.filter((x) => !x.reachable).slice(0, 2)) {
    out.push({
      kind: "egress",
      title: `Clear an egress route for ${m.label}`,
      detail: "This machine has no walkable path to an exit — open an aisle.",
      gain: 0,
      machineId: m.id,
    });
  }

  // 4. Hard safety violations from scoring.
  const errs = scoreLayout(project).violations.filter(
    (v) => v.severity === "error"
  );
  for (const v of errs.slice(0, 2)) {
    out.push({
      kind: "safety",
      title: "Resolve a safety violation",
      detail: v.message,
      gain: 0,
    });
  }

  return out;
}

/** Try placing `mover` on each side of `anchor`; return the best score gain. */
function bestAdjacentPlacement(
  project: LayoutProject,
  mover: Machine,
  anchor: Machine
): { pos: Vec2; gain: number } | null {
  if (!anchor.pos) return null;
  const base = scoreLayout(project).total;
  const fb = bbox(project.floor.boundary);
  const mf = rotatedFootprint(mover);
  const af = rotatedFootprint(anchor);
  const gap = Math.max(mover.clearance, 0.4);

  const candidates: Vec2[] = [
    { x: anchor.pos.x + af.w + gap, y: anchor.pos.y }, // right
    { x: anchor.pos.x - mf.w - gap, y: anchor.pos.y }, // left
    { x: anchor.pos.x, y: anchor.pos.y + af.d + gap }, // below
    { x: anchor.pos.x, y: anchor.pos.y - mf.d - gap }, // above
  ];

  let best: { pos: Vec2; gain: number } | null = null;
  for (const c of candidates) {
    const pos = {
      x: Math.min(Math.max(fb.x, c.x), Math.max(fb.x, fb.x + fb.w - mf.w)),
      y: Math.min(Math.max(fb.y, c.y), Math.max(fb.y, fb.y + fb.h - mf.d)),
    };
    const placements = project.machines.map((m) => ({
      machineId: m.id,
      pos: m.id === mover.id ? pos : m.pos ?? { x: 0, y: 0 },
      rotationDeg: (m.id === mover.id ? mover.rotationDeg : m.rotationDeg) ?? 0,
    }));
    const total = scoreLayout(project, placements).total;
    const gain = total - base;
    if (!best || gain > best.gain) best = { pos, gain };
  }
  return best;
}

import { describe, it, expect } from "vitest";
import type { LayoutProject, Machine } from "@/lib/types";
import { DEFAULT_SOLVER_SETTINGS, DEFAULT_WEIGHTS } from "@/lib/types";
import { anneal, mulberry32, constructiveInit } from "@/lib/optimizer/anneal";
import { scoreLayout } from "@/lib/optimizer/scoring";

function machine(
  id: string,
  x: number,
  y: number,
  extra: Partial<Machine> = {}
): Machine {
  return {
    id,
    type: "assembly_station",
    label: id,
    footprint: { w: 2, d: 2 },
    clearance: 0.5,
    heatOutput: "low",
    rotationDeg: 0,
    pos: { x, y },
    ...extra,
  };
}

function demoProject(): LayoutProject {
  const machines: Machine[] = [
    machine("raw", 1, 1, { type: "raw_material" }),
    machine("p1", 25, 1, { type: "3d_printer" }),
    machine("p2", 25, 5, { type: "3d_printer" }),
    machine("post", 1, 25, { type: "post_processing" }),
    machine("qc", 25, 25, { type: "qc_inspection" }),
    machine("asm", 13, 13, { type: "assembly_station" }),
    machine("pack", 1, 13, { type: "packaging" }),
  ];
  return {
    id: "demo",
    name: "demo",
    floor: {
      id: "f",
      name: "f",
      boundary: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 30 },
        { x: 0, y: 30 },
      ],
      obstacles: [],
      docks: [],
      gridResolution: 0.5,
    },
    machines,
    flows: [
      { from: "raw", to: "p1", unitsPerDay: 50 },
      { from: "raw", to: "p2", unitsPerDay: 50 },
      { from: "p1", to: "post", unitsPerDay: 50 },
      { from: "p2", to: "post", unitsPerDay: 50 },
      { from: "post", to: "qc", unitsPerDay: 100 },
      { from: "qc", to: "asm", unitsPerDay: 100 },
      { from: "asm", to: "pack", unitsPerDay: 100 },
    ],
    safetyRules: [{ id: "aisle", kind: "min_aisle_width", value: 1 }],
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: "now",
    updatedAt: "now",
  };
}

const fastSettings = { ...DEFAULT_SOLVER_SETTINGS, iterations: 1500, seed: 42 };

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("constructiveInit", () => {
  it("produces a placement for every machine without overlaps", () => {
    const p = demoProject();
    const state = constructiveInit(p, mulberry32(1));
    expect(state.length).toBe(p.machines.length);
    const placements = state.map((s) => ({
      machineId: s.id,
      pos: s.pos,
      rotationDeg: s.rot,
    }));
    const score = scoreLayout(p, placements);
    const overlaps = score.violations.filter((v) => v.ruleId === "overlap");
    expect(overlaps.length).toBe(0);
  });
});

describe("anneal", () => {
  it("improves or holds the score vs. the constructive start", () => {
    const p = demoProject();
    const start = scoreLayout(
      p,
      constructiveInit(p, mulberry32(fastSettings.seed)).map((s) => ({
        machineId: s.id,
        pos: s.pos,
        rotationDeg: s.rot,
      }))
    );
    const res = anneal(p, { settings: fastSettings });
    expect(res.score.total).toBeGreaterThanOrEqual(start.total - 1e-6);
  });

  it("never moves fixed machines", () => {
    const p = demoProject();
    p.machines[5].fixed = true; // asm at (13,13)
    p.machines[5].pos = { x: 13, y: 13 };
    const res = anneal(p, { settings: fastSettings });
    const asm = res.placements.find((pl) => pl.machineId === "asm")!;
    expect(asm.pos).toEqual({ x: 13, y: 13 });
    expect(asm.rotationDeg).toBe(0);
  });

  it("returns a feasible (overlap-free) best layout", () => {
    const p = demoProject();
    const res = anneal(p, { settings: { ...fastSettings, iterations: 3000 } });
    const overlaps = res.score.violations.filter((v) => v.ruleId === "overlap");
    expect(overlaps.length).toBe(0);
  });

  it("emits progress updates", () => {
    const p = demoProject();
    let count = 0;
    anneal(p, {
      settings: { ...fastSettings, iterations: 1000 },
      onProgress: () => count++,
    });
    expect(count).toBeGreaterThan(0);
  });

  it("beats a deliberately bad layout on material flow", () => {
    const p = demoProject();
    const before = scoreLayout(p);
    const res = anneal(p, { settings: { ...fastSettings, iterations: 4000 } });
    expect(res.score.materialFlow).toBeGreaterThan(before.materialFlow);
  });
});

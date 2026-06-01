import { describe, it, expect } from "vitest";
import type { LayoutProject, Machine } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import {
  scoreLayout,
  collectViolations,
  flowCost,
  isFeasible,
} from "@/lib/optimizer/scoring";
import { bbox } from "@/lib/geometry";

function machine(id: string, x: number, y: number, extra: Partial<Machine> = {}): Machine {
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

function project(machines: Machine[], overrides: Partial<LayoutProject> = {}): LayoutProject {
  return {
    id: "t",
    name: "test",
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
    flows: [],
    safetyRules: [],
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: "now",
    updatedAt: "now",
    ...overrides,
  };
}

describe("flow cost & material-flow scoring", () => {
  it("falls as connected machines move closer (monotonic)", () => {
    const flows = [{ from: "a", to: "b", unitsPerDay: 100 }];
    const near = project([machine("a", 0, 0), machine("b", 3, 0)], { flows });
    const far = project([machine("a", 0, 0), machine("b", 25, 25)], { flows });

    expect(flowCost(near, near.machines)).toBeLessThan(
      flowCost(far, far.machines)
    );
    expect(scoreLayout(near).materialFlow).toBeGreaterThan(
      scoreLayout(far).materialFlow
    );
  });

  it("scores a perfect 100 for material flow when there are no flows", () => {
    const p = project([machine("a", 0, 0), machine("b", 20, 20)]);
    expect(scoreLayout(p).materialFlow).toBe(100);
  });

  it("raises the composite total as the dominant flow pillar improves", () => {
    const flows = [{ from: "a", to: "b", unitsPerDay: 200 }];
    const weights = { materialFlow: 0.8, safety: 0.1, utilization: 0.1 };
    const near = project([machine("a", 2, 2), machine("b", 6, 2)], { flows, weights });
    const far = project([machine("a", 2, 2), machine("b", 26, 26)], { flows, weights });
    expect(scoreLayout(near).total).toBeGreaterThan(scoreLayout(far).total);
  });
});

describe("hard violations", () => {
  it("flags overlapping machines as an error and marks layout infeasible", () => {
    const p = project([machine("a", 0, 0), machine("b", 1, 1)]); // 2x2 footprints overlap
    const v = collectViolations(p, p.machines, bbox(p.floor.boundary));
    expect(v.some((x) => x.ruleId === "overlap" && x.severity === "error")).toBe(
      true
    );
    expect(isFeasible(p)).toBe(false);
    expect(scoreLayout(p).safety).toBeLessThan(100);
  });

  it("flags a machine placed outside the boundary", () => {
    const p = project([machine("a", 29, 29)]); // 2x2 extends past 30x30
    const v = collectViolations(p, p.machines, bbox(p.floor.boundary));
    expect(v.some((x) => x.ruleId === "bounds")).toBe(true);
  });

  it("flags a machine inside a no-go zone", () => {
    const p = project([machine("a", 10, 10)], {
      safetyRules: [
        {
          id: "ng",
          kind: "no_go_zone",
          zone: [
            { x: 9, y: 9 },
            { x: 14, y: 9 },
            { x: 14, y: 14 },
            { x: 9, y: 14 },
          ],
        },
      ],
    });
    const v = collectViolations(p, p.machines, bbox(p.floor.boundary));
    expect(v.some((x) => x.ruleId === "ng" && x.severity === "error")).toBe(true);
    expect(isFeasible(p)).toBe(false);
  });

  it("flags insufficient heat separation between high-heat machines", () => {
    const p = project(
      [
        machine("a", 0, 0, { heatOutput: "high" }),
        machine("b", 2.5, 0, { heatOutput: "high" }),
      ],
      {
        safetyRules: [{ id: "heat", kind: "heat_separation", value: 2 }],
      }
    );
    const v = collectViolations(p, p.machines, bbox(p.floor.boundary));
    expect(v.some((x) => x.ruleId === "heat" && x.severity === "error")).toBe(
      true
    );
  });

  it("warns on aisles narrower than the minimum width", () => {
    const p = project([machine("a", 0, 0), machine("b", 2.5, 0)], {
      safetyRules: [{ id: "aisle", kind: "min_aisle_width", value: 1.2 }],
    });
    const v = collectViolations(p, p.machines, bbox(p.floor.boundary));
    expect(v.some((x) => x.ruleId === "aisle" && x.severity === "warn")).toBe(
      true
    );
  });
});

describe("composite score", () => {
  it("returns all pillars within 0..100", () => {
    const p = project([machine("a", 2, 2), machine("b", 6, 6)]);
    const s = scoreLayout(p);
    for (const v of [s.total, s.materialFlow, s.safety, s.utilization]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("gives a clean, well-separated layout a high safety score", () => {
    const p = project([machine("a", 2, 2), machine("b", 20, 20)], {
      safetyRules: [{ id: "aisle", kind: "min_aisle_width", value: 1.2 }],
    });
    expect(scoreLayout(p).safety).toBe(100);
  });
});

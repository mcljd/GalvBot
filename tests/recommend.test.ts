import { describe, it, expect } from "vitest";
import type { LayoutProject, Machine } from "@/lib/types";
import { generateSuggestions } from "@/lib/recommend";

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

function project(machines: Machine[], flows: LayoutProject["flows"], extra: Partial<LayoutProject> = {}): LayoutProject {
  return {
    id: "t",
    name: "t",
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
      exits: [
        { id: "e1", pos: { x: 0, y: 15 } },
        { id: "e2", pos: { x: 30, y: 15 } },
      ],
      gridResolution: 0.5,
    },
    machines,
    flows,
    safetyRules: [],
    weights: { materialFlow: 0.8, safety: 0.1, utilization: 0.1 },
    createdAt: "now",
    updatedAt: "now",
    ...extra,
  };
}

describe("generateSuggestions", () => {
  it("suggests moving a far high-flow machine closer, with a real positive gain", () => {
    const p = project(
      [machine("a", 1, 1), machine("b", 26, 26)],
      [{ from: "a", to: "b", unitsPerDay: 300 }]
    );
    const s = generateSuggestions(p);
    const flow = s.find((x) => x.kind === "flow");
    expect(flow).toBeTruthy();
    expect(flow!.gain).toBeGreaterThan(0);
    expect(flow!.machineId).toBeDefined();
  });

  it("does not suggest relocation for an already-adjacent pair", () => {
    const p = project(
      [machine("a", 5, 5), machine("b", 7.5, 5)],
      [{ from: "a", to: "b", unitsPerDay: 100 }]
    );
    const s = generateSuggestions(p);
    expect(s.filter((x) => x.kind === "flow").length).toBe(0);
  });

  it("flags an over-capacity bottleneck", () => {
    const p = project(
      [
        machine("raw", 1, 1, { type: "raw_material" }),
        machine("printer", 5, 5, { type: "3d_printer" }),
      ],
      [{ from: "raw", to: "printer", unitsPerDay: 60 }] // printer cap 12
    );
    const s = generateSuggestions(p);
    expect(s.some((x) => x.kind === "capacity")).toBe(true);
  });

  it("recommends adding exits when there are too few", () => {
    const p = project([machine("a", 5, 5)], [], {
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
        exits: [{ id: "e1", pos: { x: 0, y: 15 } }],
        gridResolution: 0.5,
      },
    });
    const s = generateSuggestions(p);
    expect(s.some((x) => x.kind === "egress")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import type { LayoutProject, Machine } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import { computeAnalytics } from "@/lib/analytics";

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
    name: "t",
    floor: {
      id: "f",
      name: "f",
      boundary: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
      ],
      obstacles: [],
      docks: [],
      gridResolution: 1,
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

describe("analytics", () => {
  it("sums power, footprint area, and utilization", () => {
    const p = project([
      machine("a", 1, 1, { powerKw: 5 }),
      machine("b", 6, 6, { powerKw: 3 }),
    ]);
    const a = computeAnalytics(p);
    expect(a.machineCount).toBe(2);
    expect(a.totalPowerKw).toBe(8);
    expect(a.footprintArea).toBe(8); // two 2x2
    expect(a.usableFloorArea).toBe(400);
    expect(a.utilizationPct).toBeCloseTo(2, 1);
  });

  it("falls back to default power when a machine has none", () => {
    const p = project([machine("a", 1, 1, { type: "cnc" })]);
    // cnc default = 7.5 kW
    expect(computeAnalytics(p).totalPowerKw).toBe(7.5);
  });

  it("skips reachability when there is no inbound dock", () => {
    const a = computeAnalytics(project([machine("a", 1, 1)]));
    expect(a.reachabilityChecked).toBe(false);
    expect(a.unreachable).toEqual([]);
  });

  it("reports all machines reachable on an open floor with a dock", () => {
    const p = project([machine("a", 5, 5), machine("b", 14, 14)], {
      floor: {
        id: "f",
        name: "f",
        boundary: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
        ],
        obstacles: [],
        docks: [{ id: "in", pos: { x: 0, y: 10 }, type: "inbound" }],
        gridResolution: 1,
      },
    });
    const a = computeAnalytics(p);
    expect(a.reachabilityChecked).toBe(true);
    expect(a.unreachable).toEqual([]);
  });

  it("flags a machine walled off from the dock", () => {
    // machine "b" boxed in by no-go zones on all sides
    const p = project([machine("a", 2, 2), machine("b", 14, 14)], {
      floor: {
        id: "f",
        name: "f",
        boundary: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
        ],
        obstacles: [],
        docks: [{ id: "in", pos: { x: 0, y: 2 }, type: "inbound" }],
        gridResolution: 1,
      },
      safetyRules: [
        { id: "z1", kind: "no_go_zone", zone: rect(12, 11, 17, 12) },
        { id: "z2", kind: "no_go_zone", zone: rect(12, 17, 17, 18) },
        { id: "z3", kind: "no_go_zone", zone: rect(11, 11, 12, 18) },
        { id: "z4", kind: "no_go_zone", zone: rect(17, 11, 18, 18) },
      ],
    });
    const a = computeAnalytics(p);
    expect(a.reachabilityChecked).toBe(true);
    expect(a.unreachable).toContain("b");
    expect(a.unreachable).not.toContain("a");
  });
});

function rect(x0: number, y0: number, x1: number, y1: number) {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

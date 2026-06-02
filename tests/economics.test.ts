import { describe, it, expect } from "vitest";
import type { LayoutProject, Machine } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import {
  computeBusinessCase,
  estimateAnnualTransportCost,
  DEFAULT_ASSUMPTIONS,
} from "@/lib/economics";

function machine(id: string, x: number, y: number, extra: Partial<Machine> = {}): Machine {
  return {
    id,
    type: "assembly_station",
    label: id,
    footprint: { w: 2, d: 2 },
    clearance: 0.5,
    rotationDeg: 0,
    pos: { x, y },
    ...extra,
  };
}

function project(machines: Machine[], flows: LayoutProject["flows"]): LayoutProject {
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
      gridResolution: 1,
    },
    machines,
    flows,
    safetyRules: [],
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: "now",
    updatedAt: "now",
  };
}

describe("estimateAnnualTransportCost", () => {
  it("scales hours with distance and cost with the labor rate", () => {
    const a = estimateAnnualTransportCost(75 * 60, DEFAULT_ASSUMPTIONS); // 4500 m/day
    // 4500 m/day ÷ 75 m/min ÷ 60 = 1 hr/day × 250 days = 250 hr
    expect(a.hours).toBeCloseTo(250, 5);
    expect(a.cost).toBeCloseTo(250 * DEFAULT_ASSUMPTIONS.laborRatePerHour, 5);
  });

  it("is monotonic in distance", () => {
    const lo = estimateAnnualTransportCost(1000);
    const hi = estimateAnnualTransportCost(5000);
    expect(hi.cost).toBeGreaterThan(lo.cost);
  });
});

describe("computeBusinessCase", () => {
  it("identifies the highest-utilization station as the bottleneck", () => {
    // printer cap 12/day, fed 40/day → utilization 3.3 (way over)
    const p = project(
      [
        machine("raw", 1, 1, { type: "raw_material" }),
        machine("printer", 5, 5, { type: "3d_printer" }),
        machine("qc", 10, 10, { type: "qc_inspection" }),
      ],
      [
        { from: "raw", to: "printer", unitsPerDay: 40 },
        { from: "printer", to: "qc", unitsPerDay: 40 },
      ]
    );
    const bc = computeBusinessCase(p);
    expect(bc.bottleneck?.id).toBe("printer");
    expect(bc.bottleneck!.utilization).toBeGreaterThan(1);
    expect(bc.overCapacity.map((s) => s.id)).toContain("printer");
    // qc cap 200 fed 40 → under capacity
    expect(bc.overCapacity.map((s) => s.id)).not.toContain("qc");
  });

  it("produces a positive annual transport cost when flows exist", () => {
    const p = project(
      [machine("a", 1, 1), machine("b", 25, 25)],
      [{ from: "a", to: "b", unitsPerDay: 100 }]
    );
    const bc = computeBusinessCase(p);
    expect(bc.routedMetersPerDay).toBeGreaterThan(0);
    expect(bc.annualTransportCost).toBeGreaterThan(0);
  });

  it("skips passive (zero-capacity) machines from the station list", () => {
    const p = project(
      [
        machine("raw", 1, 1, { type: "raw_material" }), // capacity 0
        machine("asm", 5, 5, { type: "assembly_station" }),
      ],
      [{ from: "raw", to: "asm", unitsPerDay: 30 }]
    );
    const bc = computeBusinessCase(p);
    expect(bc.stations.map((s) => s.id)).not.toContain("raw");
    expect(bc.stations.map((s) => s.id)).toContain("asm");
  });
});

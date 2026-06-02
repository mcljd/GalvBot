import { describe, it, expect } from "vitest";
import type { Floor, LayoutProject, Machine } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import { computeCompliance, distanceTransform } from "@/lib/compliance";
import { buildCostGrid } from "@/lib/optimizer/grid";

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

function project(floor: Floor, machines: Machine[]): LayoutProject {
  return {
    id: "t",
    name: "t",
    floor,
    machines,
    flows: [],
    safetyRules: [],
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: "now",
    updatedAt: "now",
  };
}

function rectFloor(w: number, h: number, extra: Partial<Floor> = {}): Floor {
  return {
    id: "f",
    name: "f",
    boundary: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    obstacles: [],
    docks: [],
    gridResolution: 0.5,
    ...extra,
  };
}

describe("distanceTransform", () => {
  it("gives larger clearance to cells in open space than near walls", () => {
    const p = project(rectFloor(20, 20), []);
    const grid = buildCostGrid(p, { blockMachines: true });
    const D = distanceTransform(grid);
    const center = worldIdx(grid, 10, 10);
    const nearWall = worldIdx(grid, 0.5, 10);
    expect(D[center]).toBeGreaterThan(D[nearWall]);
  });
});

function worldIdx(
  grid: { cols: number; origin: { x: number; y: number }; cell: number },
  x: number,
  y: number
) {
  const cx = Math.floor((x - grid.origin.x) / grid.cell);
  const cy = Math.floor((y - grid.origin.y) / grid.cell);
  return cy * grid.cols + cx;
}

describe("computeCompliance", () => {
  it("passes an open floor with two exits and one machine", () => {
    const floor = rectFloor(20, 20, {
      exits: [
        { id: "e1", pos: { x: 0, y: 10 } },
        { id: "e2", pos: { x: 20, y: 10 } },
      ],
    });
    const rep = computeCompliance(project(floor, [machine("m", 9, 9)]));
    expect(rep.exitCount).toBe(2);
    expect(rep.exitsDefined).toBe(true);
    expect(rep.machines[0].reachable).toBe(true);
    expect(rep.violations.some((v) => v.severity === "error")).toBe(false);
    expect(rep.narrowestAisle).toBeGreaterThan(1.12);
  });

  it("flags too few exits", () => {
    const floor = rectFloor(20, 20, {
      exits: [{ id: "e1", pos: { x: 0, y: 10 } }],
    });
    const rep = computeCompliance(project(floor, [machine("m", 9, 9)]));
    expect(rep.violations.some((v) => v.ruleId === "exits" && v.severity === "error")).toBe(true);
  });

  it("detects a machine with no walkable route to an exit", () => {
    // box machine "b" in with no-go zones on all four sides
    const floor = rectFloor(20, 20, {
      exits: [
        { id: "e1", pos: { x: 0, y: 1 } },
        { id: "e2", pos: { x: 20, y: 1 } },
      ],
    });
    const p = project(floor, [machine("a", 1, 1), machine("b", 14, 14)]);
    p.safetyRules = [
      { id: "z1", kind: "no_go_zone", zone: rect(12, 11, 17, 12) },
      { id: "z2", kind: "no_go_zone", zone: rect(12, 17, 17, 18) },
      { id: "z3", kind: "no_go_zone", zone: rect(11, 11, 12, 18) },
      { id: "z4", kind: "no_go_zone", zone: rect(17, 11, 18, 18) },
    ];
    const rep = computeCompliance(p);
    const b = rep.machines.find((m) => m.id === "b")!;
    expect(b.reachable).toBe(false);
    expect(rep.violations.some((v) => v.ruleId === "egress" && v.severity === "error")).toBe(true);
  });

  it("flags a pinch point where the only egress route is too narrow", () => {
    // wall across the middle with a 1.0 m gap; require 1.5 m
    const floor = rectFloor(20, 20, {
      obstacles: [
        { id: "wl", polygon: rect(0, 9.5, 9.5, 10.5) },
        { id: "wr", polygon: rect(10.5, 9.5, 20, 10.5) },
      ],
      exits: [
        { id: "e1", pos: { x: 10, y: 20 } },
        { id: "e2", pos: { x: 0, y: 19 } },
      ],
    });
    // machine in the top half; the only way south to the bottom exits is the gap
    const rep = computeCompliance(project(floor, [machine("m", 9, 2)]), {
      minAisleWidth: 1.5,
      maxTravelDistance: 61,
      minExits: 2,
    });
    expect(rep.machines[0].reachable).toBe(true);
    expect(rep.machines[0].minAisleWidth).toBeLessThan(1.5);
    expect(rep.violations.some((v) => v.ruleId === "aisle")).toBe(true);
  });

  it("falls back to docks and warns when no exits are defined", () => {
    const floor = rectFloor(20, 20, {
      docks: [{ id: "d", pos: { x: 0, y: 10 }, type: "outbound" }],
    });
    const rep = computeCompliance(project(floor, [machine("m", 9, 9)]));
    expect(rep.exitsDefined).toBe(false);
    expect(rep.violations.some((v) => v.ruleId === "exits" && v.severity === "warn")).toBe(true);
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

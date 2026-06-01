import { describe, it, expect } from "vitest";
import type { LayoutProject } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import { buildCostGrid, worldToCell } from "@/lib/optimizer/grid";
import { routeCells } from "@/lib/flow/routing";
import { computeFlowHeatmap } from "@/lib/flow/heatmap";

function baseProject(overrides: Partial<LayoutProject> = {}): LayoutProject {
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
    machines: [],
    flows: [],
    safetyRules: [],
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: "now",
    updatedAt: "now",
    ...overrides,
  };
}

describe("cost grid", () => {
  it("hard-blocks cells inside a no-go zone", () => {
    const p = baseProject({
      safetyRules: [
        {
          id: "ng",
          kind: "no_go_zone",
          zone: [
            { x: 8, y: 8 },
            { x: 12, y: 8 },
            { x: 12, y: 12 },
            { x: 8, y: 12 },
          ],
        },
      ],
    });
    const grid = buildCostGrid(p);
    const { cx, cy } = worldToCell(grid, { x: 10, y: 10 });
    expect(grid.cost[cy * grid.cols + cx]).toBe(Infinity);
  });

  it("marks cells outside the boundary polygon as blocked", () => {
    // L-shaped floor: top-right quadrant cut out
    const p = baseProject({
      floor: {
        id: "f",
        name: "f",
        boundary: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
        ],
        obstacles: [],
        docks: [],
        gridResolution: 1,
      },
    });
    const grid = buildCostGrid(p);
    const cut = worldToCell(grid, { x: 15, y: 5 }); // in the removed quadrant
    expect(grid.cost[cut.cy * grid.cols + cut.cx]).toBe(Infinity);
  });
});

describe("A* routing", () => {
  it("finds a direct route on an empty floor", () => {
    const p = baseProject();
    const grid = buildCostGrid(p);
    const s = worldToCell(grid, { x: 1, y: 1 });
    const e = worldToCell(grid, { x: 18, y: 1 });
    const r = routeCells(grid, s.cy * grid.cols + s.cx, e.cy * grid.cols + e.cx);
    expect(r.cells.length).toBeGreaterThan(0);
    // straight horizontal run ≈ 17 m
    expect(r.length).toBeGreaterThanOrEqual(16);
    expect(r.length).toBeLessThanOrEqual(19);
  });

  it("routes around a wall, yielding a longer path than the straight line", () => {
    // vertical wall obstacle from y=0..15 at x≈10, leaving a gap at the bottom
    const p = baseProject({
      floor: {
        id: "f",
        name: "f",
        boundary: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
        ],
        obstacles: [
          {
            id: "wall",
            polygon: [
              { x: 9.5, y: 0 },
              { x: 10.5, y: 0 },
              { x: 10.5, y: 15 },
              { x: 9.5, y: 15 },
            ],
          },
        ],
        docks: [],
        gridResolution: 1,
      },
    });
    const grid = buildCostGrid(p);
    const s = worldToCell(grid, { x: 5, y: 2 });
    const e = worldToCell(grid, { x: 15, y: 2 });
    const r = routeCells(grid, s.cy * grid.cols + s.cx, e.cy * grid.cols + e.cx);
    expect(r.cells.length).toBeGreaterThan(0);
    // must detour down past the wall gap, so well beyond the ~10 m straight line
    expect(r.length).toBeGreaterThan(20);
  });

  it("returns no route when the goal is fully walled off", () => {
    const p = baseProject({
      floor: {
        id: "f",
        name: "f",
        boundary: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
        ],
        // full-height wall splitting the floor with no gap
        obstacles: [
          {
            id: "wall",
            polygon: [
              { x: 9.5, y: 0 },
              { x: 10.5, y: 0 },
              { x: 10.5, y: 20 },
              { x: 9.5, y: 20 },
            ],
          },
        ],
        docks: [],
        gridResolution: 1,
      },
    });
    const grid = buildCostGrid(p);
    const s = worldToCell(grid, { x: 5, y: 10 });
    const e = worldToCell(grid, { x: 15, y: 10 });
    const r = routeCells(grid, s.cy * grid.cols + s.cx, e.cy * grid.cols + e.cx);
    expect(r.cells.length).toBe(0);
  });
});

describe("flow heatmap", () => {
  it("accumulates throughput along routes and reports routed work", () => {
    const p = baseProject({
      machines: [
        {
          id: "a",
          type: "raw_material",
          label: "A",
          footprint: { w: 2, d: 2 },
          clearance: 0.5,
          pos: { x: 1, y: 1 },
          rotationDeg: 0,
        },
        {
          id: "b",
          type: "packaging",
          label: "B",
          footprint: { w: 2, d: 2 },
          clearance: 0.5,
          pos: { x: 16, y: 16 },
          rotationDeg: 0,
        },
      ],
      flows: [{ from: "a", to: "b", unitsPerDay: 100 }],
    });
    const field = computeFlowHeatmap(p);
    expect(field.max).toBeGreaterThanOrEqual(100);
    expect(field.routedWork).toBeGreaterThan(0);
    expect(field.values.some((v) => v > 0)).toBe(true);
  });
});

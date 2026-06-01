import { describe, it, expect } from "vitest";
import { computeSnap } from "@/lib/editor/snap";
import type { Rect } from "@/lib/geometry";

const floor: Rect = { x: 0, y: 0, w: 20, h: 20 };

describe("computeSnap", () => {
  it("snaps to a nearby machine's left edge", () => {
    const moving = { pos: { x: 5.15, y: 8 }, w: 2, d: 2 };
    const others = [{ pos: { x: 5, y: 1 }, w: 2, d: 2 }];
    const r = computeSnap(moving, others, floor, 0.5, 0.3);
    expect(r.pos.x).toBeCloseTo(5, 5);
    expect(r.guideX).toBeCloseTo(5, 5);
  });

  it("falls back to the grid when nothing is close", () => {
    const moving = { pos: { x: 7.4, y: 7.4 }, w: 2, d: 2 };
    const r = computeSnap(moving, [], floor, 1, 0.3);
    expect(r.pos.x).toBe(7);
    expect(r.pos.y).toBe(7);
    expect(r.guideX).toBeUndefined();
    expect(r.guideY).toBeUndefined();
  });

  it("aligns centers when two machines share a center line", () => {
    // other center x = 10; moving (w=4) center should land at 10 → pos.x = 8
    const moving = { pos: { x: 7.9, y: 2 }, w: 4, d: 2 };
    const others = [{ pos: { x: 9, y: 12 }, w: 2, d: 2 }];
    const r = computeSnap(moving, others, floor, 0.5, 0.3);
    expect(r.pos.x).toBeCloseTo(8, 5);
    expect(r.guideX).toBeCloseTo(10, 5);
  });

  it("snaps to the floor's right edge", () => {
    const moving = { pos: { x: 17.85, y: 5 }, w: 2, d: 2 }; // right edge 19.85 → 20
    const r = computeSnap(moving, [], floor, 0.5, 0.3);
    expect(r.pos.x).toBeCloseTo(18, 5);
    expect(r.guideX).toBeCloseTo(20, 5);
  });
});

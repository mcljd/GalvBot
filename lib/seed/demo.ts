import type {
  Floor,
  FlowEdge,
  LayoutProject,
  Machine,
  MachineType,
  SafetyRule,
} from "@/lib/types";
import { DEFAULT_WEIGHTS, MACHINE_META } from "@/lib/types";

/**
 * A realistic hybrid manufacturing shop used as the pre-loaded demo:
 * 3 FDM printers, 1 SLA, 2 CNC, post-processing, QC, 2 assembly stations,
 * packaging, raw-material + finished-goods storage, inbound/outbound docks.
 *
 * Floor is a 30m x 20m bay with two structural pillars.
 */

const DEMO_ID = "demo-hybrid-shop";

function mk(
  id: string,
  type: MachineType,
  label: string,
  pos: { x: number; y: number },
  overrides: Partial<Machine> = {}
): Machine {
  const meta = MACHINE_META[type];
  return {
    id,
    type,
    label,
    footprint: { ...meta.defaultFootprint },
    clearance: meta.defaultClearance,
    heatOutput: meta.defaultHeat,
    rotationDeg: 0,
    pos,
    ...overrides,
  };
}

const floor: Floor = {
  id: "floor-demo",
  name: "Bay A — Main Shop",
  boundary: [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 },
    { x: 0, y: 20 },
  ],
  obstacles: [
    {
      id: "pillar-1",
      label: "Pillar",
      polygon: [
        { x: 10, y: 9.5 },
        { x: 10.6, y: 9.5 },
        { x: 10.6, y: 10.1 },
        { x: 10, y: 10.1 },
      ],
    },
    {
      id: "pillar-2",
      label: "Pillar",
      polygon: [
        { x: 20, y: 9.5 },
        { x: 20.6, y: 9.5 },
        { x: 20.6, y: 10.1 },
        { x: 20, y: 10.1 },
      ],
    },
  ],
  docks: [
    { id: "dock-in", pos: { x: 0, y: 4 }, type: "inbound" },
    { id: "dock-out", pos: { x: 30, y: 16 }, type: "outbound" },
  ],
  gridResolution: 0.5,
};

const machines: Machine[] = [
  mk("raw", "raw_material", "Raw Material", { x: 1.5, y: 1.5 }),
  mk("print-1", "3d_printer", "FDM Printer 1", { x: 6, y: 1.5 }),
  mk("print-2", "3d_printer", "FDM Printer 2", { x: 8, y: 1.5 }),
  mk("print-3", "3d_printer", "FDM Printer 3", { x: 10, y: 1.5 }),
  mk("sla-1", "3d_printer", "SLA Printer", { x: 12.5, y: 1.5 }, {
    heatOutput: "low",
  }),
  mk("cnc-1", "cnc", "CNC Mill 1", { x: 6, y: 5 }),
  mk("cnc-2", "cnc", "CNC Mill 2", { x: 10, y: 5 }),
  mk("post", "post_processing", "Post-Processing", { x: 15, y: 5 }),
  mk("qc", "qc_inspection", "QC / Inspection", { x: 18, y: 5 }),
  mk("asm-1", "assembly_station", "Assembly 1", { x: 20, y: 12 }),
  mk("asm-2", "assembly_station", "Assembly 2", { x: 23, y: 12 }),
  mk("pack", "packaging", "Packaging", { x: 25.5, y: 15.5 }),
  mk("fg", "storage_rack", "Finished Goods", { x: 25.5, y: 1.5 }),
];

const flows: FlowEdge[] = [
  { from: "raw", to: "print-1", unitsPerDay: 40 },
  { from: "raw", to: "print-2", unitsPerDay: 40 },
  { from: "raw", to: "print-3", unitsPerDay: 40 },
  { from: "raw", to: "sla-1", unitsPerDay: 20 },
  { from: "raw", to: "cnc-1", unitsPerDay: 60 },
  { from: "raw", to: "cnc-2", unitsPerDay: 60 },
  { from: "print-1", to: "post", unitsPerDay: 40 },
  { from: "print-2", to: "post", unitsPerDay: 40 },
  { from: "print-3", to: "post", unitsPerDay: 40 },
  { from: "sla-1", to: "post", unitsPerDay: 20 },
  { from: "cnc-1", to: "qc", unitsPerDay: 60 },
  { from: "cnc-2", to: "qc", unitsPerDay: 60 },
  { from: "post", to: "qc", unitsPerDay: 140 },
  { from: "qc", to: "asm-1", unitsPerDay: 130 },
  { from: "qc", to: "asm-2", unitsPerDay: 130 },
  { from: "asm-1", to: "pack", unitsPerDay: 120 },
  { from: "asm-2", to: "pack", unitsPerDay: 120 },
  { from: "pack", to: "fg", unitsPerDay: 240 },
];

const safetyRules: SafetyRule[] = [
  { id: "rule-aisle", kind: "min_aisle_width", value: 1.2 },
  { id: "rule-exit", kind: "exit_clearance", value: 1.5 },
  { id: "rule-heat", kind: "heat_separation", value: 1.5 },
  {
    id: "rule-nogo",
    kind: "no_go_zone",
    zone: [
      { x: 14, y: 16 },
      { x: 17, y: 16 },
      { x: 17, y: 19 },
      { x: 14, y: 19 },
    ],
  },
];

export function makeDemoProject(now = new Date().toISOString()): LayoutProject {
  return {
    id: DEMO_ID,
    name: "Demo — Hybrid Additive + Assembly Shop",
    floor: structuredClone(floor),
    machines: structuredClone(machines),
    flows: structuredClone(flows),
    safetyRules: structuredClone(safetyRules),
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: now,
    updatedAt: now,
  };
}

export const DEMO_PROJECT_ID = DEMO_ID;

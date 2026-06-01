/**
 * GalvBot core data model — the single source of truth for layout projects.
 * All spatial units are meters unless noted. Canvas concerns live elsewhere.
 */

export type Vec2 = { x: number; y: number }; // meters

export interface Floor {
  id: string;
  name: string;
  /** Outer boundary polygon (meters), assumed simple and roughly rectangular. */
  boundary: Vec2[];
  /** Interior obstacles: pillars, fixed walls, etc. */
  obstacles: { id: string; polygon: Vec2[]; label?: string }[];
  /** Fixed inbound/outbound dock points. */
  docks: { id: string; pos: Vec2; type: "inbound" | "outbound" }[];
  /** Meters per cell for the solver's discretized grid. */
  gridResolution: number;
}

export type MachineType =
  | "3d_printer"
  | "cnc"
  | "assembly_station"
  | "qc_inspection"
  | "packaging"
  | "storage_rack"
  | "post_processing"
  | "raw_material";

export interface Machine {
  id: string;
  type: MachineType;
  label: string;
  /** Footprint in meters (width x depth). */
  footprint: { w: number; d: number };
  /** Required walkable margin around the machine, in meters. */
  clearance: number;
  powerKw?: number;
  /** Heat output influences required separation between machines. */
  heatOutput?: "low" | "med" | "high";
  /** Position of the footprint's top-left origin, assigned by solver or user. */
  pos?: Vec2;
  rotationDeg?: 0 | 90 | 180 | 270;
  /** User-locked: the solver must never move or rotate this machine. */
  fixed?: boolean;
}

export interface FlowEdge {
  from: string; // machine id
  to: string; // machine id
  unitsPerDay: number; // throughput → weight for distance cost
}

export type SafetyRuleKind =
  | "min_aisle_width"
  | "exit_clearance"
  | "heat_separation"
  | "no_go_zone";

export interface SafetyRule {
  id: string;
  kind: SafetyRuleKind;
  /** Meters, for width/clearance/separation rules. */
  value?: number;
  /** Polygon for no_go_zone rules. */
  zone?: Vec2[];
}

/** User-tunable objective weights (0..1, normalized at scoring time). */
export interface ObjectiveWeights {
  materialFlow: number;
  safety: number;
  utilization: number;
}

export interface LayoutProject {
  id: string;
  name: string;
  floor: Floor;
  machines: Machine[];
  flows: FlowEdge[];
  safetyRules: SafetyRule[];
  weights: ObjectiveWeights;
  createdAt: string;
  updatedAt: string;
}

export interface Violation {
  ruleId: string;
  message: string;
  severity: "warn" | "error";
}

export interface LayoutScore {
  /** Weighted composite, 0..100, higher = better. */
  total: number;
  /** Per-pillar sub-scores, each normalized 0..100 (higher = better). */
  materialFlow: number;
  safety: number;
  utilization: number;
  violations: Violation[];
}

export interface Placement {
  machineId: string;
  pos: Vec2;
  rotationDeg: 0 | 90 | 180 | 270;
}

export interface OptimizationResult {
  placements: Placement[];
  score: LayoutScore;
  iterations: number;
}

/** Simulated-annealing / search tuning, surfaced in the Solver settings panel. */
export interface SolverSettings {
  iterations: number;
  startTemp: number;
  endTemp: number;
  /** Probability weights for SA moves. */
  moveWeights: {
    translate: number;
    rotate: number;
    swap: number;
  };
  seed?: number;
}

export const DEFAULT_WEIGHTS: ObjectiveWeights = {
  materialFlow: 0.5,
  safety: 0.3,
  utilization: 0.2,
};

export const DEFAULT_SOLVER_SETTINGS: SolverSettings = {
  iterations: 4000,
  startTemp: 12,
  endTemp: 0.05,
  moveWeights: { translate: 0.6, rotate: 0.2, swap: 0.2 },
};

/** Human-readable metadata for each machine type. */
export const MACHINE_META: Record<
  MachineType,
  { label: string; color: string; defaultFootprint: { w: number; d: number }; defaultClearance: number; defaultHeat: "low" | "med" | "high" }
> = {
  "3d_printer": {
    label: "3D Printer (FDM/SLA)",
    color: "#f97316",
    defaultFootprint: { w: 1.2, d: 1.0 },
    defaultClearance: 0.8,
    defaultHeat: "med",
  },
  cnc: {
    label: "CNC Machine",
    color: "#3b82f6",
    defaultFootprint: { w: 2.4, d: 2.0 },
    defaultClearance: 1.0,
    defaultHeat: "high",
  },
  assembly_station: {
    label: "Assembly Station",
    color: "#22c55e",
    defaultFootprint: { w: 2.0, d: 1.5 },
    defaultClearance: 1.0,
    defaultHeat: "low",
  },
  qc_inspection: {
    label: "QC / Inspection",
    color: "#a855f7",
    defaultFootprint: { w: 1.5, d: 1.5 },
    defaultClearance: 0.8,
    defaultHeat: "low",
  },
  packaging: {
    label: "Packaging",
    color: "#14b8a6",
    defaultFootprint: { w: 2.5, d: 1.8 },
    defaultClearance: 1.0,
    defaultHeat: "low",
  },
  storage_rack: {
    label: "Storage Rack",
    color: "#64748b",
    defaultFootprint: { w: 3.0, d: 1.2 },
    defaultClearance: 0.6,
    defaultHeat: "low",
  },
  post_processing: {
    label: "Post-Processing",
    color: "#eab308",
    defaultFootprint: { w: 1.8, d: 1.5 },
    defaultClearance: 0.9,
    defaultHeat: "med",
  },
  raw_material: {
    label: "Raw Material",
    color: "#92400e",
    defaultFootprint: { w: 2.5, d: 2.0 },
    defaultClearance: 0.8,
    defaultHeat: "low",
  },
};

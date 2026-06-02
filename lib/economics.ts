import type { LayoutProject } from "@/lib/types";
import { MACHINE_META } from "@/lib/types";
import { computeFlowHeatmap } from "@/lib/flow/heatmap";

/**
 * Translates a layout into operating economics a plant manager cares about:
 * annual material-handling labor cost (from routed travel distance) and a
 * capacity/bottleneck view per process step. All figures are transparent,
 * assumption-driven estimates — surfaced with their inputs, never as gospel.
 */
export interface EconomicAssumptions {
  laborRatePerHour: number; // fully-loaded $/hr for material handling
  operatingDaysPerYear: number;
  walkingSpeedMetersPerMin: number; // average material-handler travel speed
}

export const DEFAULT_ASSUMPTIONS: EconomicAssumptions = {
  laborRatePerHour: 38,
  operatingDaysPerYear: 250,
  walkingSpeedMetersPerMin: 75,
};

export interface StationLoad {
  id: string;
  label: string;
  load: number; // units/day passing through (max of in/out flow)
  capacity: number; // units/day
  utilization: number; // load / capacity
}

export interface BusinessCase {
  routedMetersPerDay: number;
  annualTransportHours: number;
  annualTransportCost: number;
  stations: StationLoad[];
  bottleneck: StationLoad | null;
  /** Stations whose demand meets or exceeds capacity (utilization ≥ 1). */
  overCapacity: StationLoad[];
}

/** Convert a routed-work figure (Σ units × meters/day) into annual $ of labor. */
export function estimateAnnualTransportCost(
  routedMetersPerDay: number,
  a: EconomicAssumptions = DEFAULT_ASSUMPTIONS
): { hours: number; cost: number } {
  const hoursPerDay =
    routedMetersPerDay / Math.max(1e-6, a.walkingSpeedMetersPerMin) / 60;
  const hours = hoursPerDay * a.operatingDaysPerYear;
  return { hours, cost: hours * a.laborRatePerHour };
}

export function computeBusinessCase(
  project: LayoutProject,
  assumptions: EconomicAssumptions = DEFAULT_ASSUMPTIONS
): BusinessCase {
  const routedMetersPerDay = computeFlowHeatmap(project).routedWork;
  const { hours, cost } = estimateAnnualTransportCost(
    routedMetersPerDay,
    assumptions
  );

  const stations: StationLoad[] = [];
  for (const m of project.machines) {
    const capacity =
      m.capacityPerDay ?? MACHINE_META[m.type].defaultCapacityPerDay;
    if (!capacity || capacity <= 0) continue;
    const inbound = project.flows
      .filter((f) => f.to === m.id)
      .reduce((s, f) => s + f.unitsPerDay, 0);
    const outbound = project.flows
      .filter((f) => f.from === m.id)
      .reduce((s, f) => s + f.unitsPerDay, 0);
    const load = Math.max(inbound, outbound);
    if (load <= 0) continue;
    stations.push({
      id: m.id,
      label: m.label,
      load,
      capacity,
      utilization: load / capacity,
    });
  }

  stations.sort((a, b) => b.utilization - a.utilization);
  const bottleneck = stations[0] ?? null;
  const overCapacity = stations.filter((s) => s.utilization >= 1);

  return {
    routedMetersPerDay: Math.round(routedMetersPerDay),
    annualTransportHours: Math.round(hours),
    annualTransportCost: Math.round(cost),
    stations,
    bottleneck,
    overCapacity,
  };
}
